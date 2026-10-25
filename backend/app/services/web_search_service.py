"""Web Search, Link Scraping, Weather, Math, and Audio Transcription Services for Vadivelu AI.

Provides real-time web browsing, article reading, live weather, safe math evaluation,
and Gemini-powered audio speech transcription without relying on third-party paid APIs.
"""

import ast
import base64
import html
import logging
import math
import operator
import re
import urllib.parse
from typing import Any, Dict, List, Optional

import httpx
from app.services.gemini_service import GeminiService

logger = logging.getLogger("vadivelu.web_service")


class WebSearchService:
    """Handles live internet searches and webpage content fetching."""

    USER_AGENT = (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )

    async def search_web(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """Performs a live web search using DuckDuckGo HTML.

        Returns a list of dicts with title, url, snippet, and domain.
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        logger.info(f"Executing web search for: '{clean_query}'")
        encoded_query = urllib.parse.quote_plus(clean_query)
        url = f"https://html.duckduckgo.com/html/?q={encoded_query}"

        headers = {
            "User-Agent": self.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        results: List[Dict[str, Any]] = []

        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code != 200:
                    logger.warning(f"DuckDuckGo returned status {resp.status_code}")
                    return []

                html_content = resp.text

                # Match titles and links
                title_matches = re.findall(
                    r'<a[^>]*class=\"result__a\"[^>]*href=\"([^\"]+)\"[^>]*>(.*?)</a>',
                    html_content,
                )
                snippet_matches = re.findall(
                    r'<a[^>]*class=\"result__snippet[^\"]*\"[^>]*>(.*?)</a>',
                    html_content,
                )

                for i, (href, raw_title) in enumerate(title_matches[:max_results]):
                    title = re.sub(r"<[^>]+>", "", raw_title).strip()
                    title = html.unescape(title)

                    # Extract actual target url from DuckDuckGo redirect
                    clean_url = href
                    if "uddg=" in href:
                        qs = urllib.parse.parse_qs(urllib.parse.urlsplit(href).query)
                        if "uddg" in qs and qs["uddg"]:
                            clean_url = qs["uddg"][0]
                    elif href.startswith("//"):
                        clean_url = "https:" + href

                    # Extract snippet
                    snippet = ""
                    if i < len(snippet_matches):
                        raw_snip = re.sub(r"<[^>]+>", "", snippet_matches[i]).strip()
                        snippet = html.unescape(raw_snip)

                    # Extract domain
                    domain = ""
                    try:
                        domain = urllib.parse.urlparse(clean_url).netloc
                    except Exception:
                        pass

                    if title and clean_url:
                        results.append({
                            "title": title,
                            "url": clean_url,
                            "snippet": snippet,
                            "domain": domain,
                        })

        except Exception as e:
            logger.error(f"Error during web search: {e}", exc_info=True)

        return results

    async def fetch_webpage(self, url: str, max_length: int = 3500) -> Dict[str, Any]:
        """Fetches and extracts clean body text from any given URL.

        Useful when user asks 'what is this link bro' or shares articles/docs.
        """
        clean_url = url.strip()
        if not clean_url.startswith(("http://", "https://")):
            clean_url = "https://" + clean_url

        logger.info(f"Fetching webpage: {clean_url}")
        headers = {
            "User-Agent": self.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(clean_url, headers=headers)
                if resp.status_code >= 400:
                    return {
                        "url": clean_url,
                        "title": f"HTTP {resp.status_code}",
                        "domain": urllib.parse.urlparse(clean_url).netloc,
                        "content": f"Failed to retrieve page (HTTP {resp.status_code})",
                        "status": resp.status_code,
                    }

                html_text = resp.text

                # Extract page title
                title_match = re.search(r"<title[^>]*>(.*?)</title>", html_text, re.IGNORECASE | re.DOTALL)
                page_title = (
                    html.unescape(title_match.group(1).strip())
                    if title_match
                    else clean_url
                )

                # Strip script, style, svg, noscript
                cleaned = re.sub(
                    r"<(script|style|svg|noscript|header|footer|nav)[^>]*>.*?</\1>",
                    " ",
                    html_text,
                    flags=re.DOTALL | re.IGNORECASE,
                )

                # Strip remaining tags
                body_text = re.sub(r"<[^>]+>", " ", cleaned)
                # Unescape entities and collapse whitespace
                body_text = html.unescape(body_text)
                body_text = " ".join(body_text.split())

                # Truncate to reasonable length for context window
                truncated = body_text[:max_length]

                domain = urllib.parse.urlparse(clean_url).netloc

                return {
                    "url": clean_url,
                    "title": page_title,
                    "domain": domain,
                    "content": truncated,
                    "length": len(body_text),
                    "status": resp.status_code,
                }

        except Exception as e:
            logger.error(f"Error fetching webpage {clean_url}: {e}")
            return {
                "url": clean_url,
                "title": "Fetch Error",
                "domain": urllib.parse.urlparse(clean_url).netloc if "://" in clean_url else "",
                "content": f"Unable to reach website: {str(e)}",
                "status": 500,
            }

    async def lookup_weather(self, location: str) -> Dict[str, Any]:
        """Looks up real-time weather using wttr.in JSON service."""
        clean_loc = location.strip() or "Chennai"
        logger.info(f"Looking up weather for: {clean_loc}")
        url = f"https://wttr.in/{urllib.parse.quote_plus(clean_loc)}?format=j1"

        try:
            async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "curl/7.68.0"})
                if resp.status_code == 200:
                    data = resp.json()
                    curr = data["current_condition"][0]
                    area_info = data.get("nearest_area", [{}])[0]
                    area_name = area_info.get("areaName", [{}])[0].get("value", clean_loc)
                    country = area_info.get("country", [{}])[0].get("value", "")

                    return {
                        "location": f"{area_name}, {country}".strip(", "),
                        "temp_c": curr.get("temp_C", ""),
                        "temp_f": curr.get("temp_F", ""),
                        "condition": curr.get("weatherDesc", [{}])[0].get("value", ""),
                        "humidity": f"{curr.get('humidity', '')}%",
                        "wind_speed_kmph": curr.get("windspeedKmph", ""),
                        "feels_like_c": curr.get("FeelsLikeC", ""),
                    }
        except Exception as e:
            logger.warning(f"Weather lookup failed: {e}")

        return {"location": clean_loc, "error": "Weather data currently unavailable"}

    def calculate_math(self, expression: str) -> Dict[str, Any]:
        """Safely evaluates arithmetic expressions without eval() vulnerability."""
        allowed_operators = {
            ast.Add: operator.add,
            ast.Sub: operator.sub,
            ast.Mult: operator.mul,
            ast.Div: operator.truediv,
            ast.Pow: operator.pow,
            ast.Mod: operator.mod,
            ast.USub: operator.neg,
            ast.UAdd: operator.pos,
        }

        allowed_functions = {
            "sqrt": math.sqrt,
            "sin": math.sin,
            "cos": math.cos,
            "tan": math.tan,
            "log": math.log,
            "abs": abs,
            "round": round,
            "pi": math.pi,
            "e": math.e,
        }

        def eval_node(node):
            if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
                return node.value
            elif isinstance(node, ast.BinOp):
                op_type = type(node.op)
                if op_type in allowed_operators:
                    left = eval_node(node.left)
                    right = eval_node(node.right)
                    return allowed_operators[op_type](left, right)
            elif isinstance(node, ast.UnaryOp):
                op_type = type(node.op)
                if op_type in allowed_operators:
                    return allowed_operators[op_type](eval_node(node.operand))
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id in allowed_functions:
                    args = [eval_node(arg) for arg in node.args]
                    func = allowed_functions[node.func.id]
                    return func(*args)
            elif isinstance(node, ast.Name) and node.id in allowed_functions:
                return allowed_functions[node.id]

            raise ValueError(f"Unsupported math syntax: {ast.dump(node)}")

        clean_expr = expression.strip().replace("x", "*").replace("X", "*")
        clean_expr = clean_expr.replace("^", "**")

        try:
            tree = ast.parse(clean_expr, mode="eval")
            result = eval_node(tree.body)
            # Format nicely
            if isinstance(result, float) and result.is_integer():
                result = int(result)
            elif isinstance(result, float):
                result = round(result, 6)
            return {"expression": expression, "result": result, "status": "success"}
        except Exception as e:
            return {"expression": expression, "error": f"Invalid expression: {str(e)}", "status": "error"}

    async def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
        """Transcribes spoken audio into text using Gemini 3.5 Flash, normalized via ffmpeg."""
        if not audio_bytes or len(audio_bytes) < 100:
            return ""

        # Normalize any uploaded container (webm, ogg, mp4) into standard 16kHz mono WAV for Gemini
        wav_bytes = audio_bytes
        target_mime = mime_type
        try:
            import subprocess
            p = subprocess.run(
                ["ffmpeg", "-y", "-i", "pipe:0", "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1"],
                input=audio_bytes,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=5,
            )
            if p.returncode == 0 and len(p.stdout) > 44:
                wav_bytes = p.stdout
                target_mime = "audio/wav"
                logger.info(f"Converted {len(audio_bytes)} bytes ({mime_type}) to {len(wav_bytes)} bytes WAV")
        except Exception as conv_err:
            logger.warning(f"Audio ffmpeg conversion to wav failed, using original format: {conv_err}")

        logger.info(f"Transcribing audio ({len(wav_bytes)} bytes, {target_mime}) via Gemini...")
        b64_data = base64.b64encode(wav_bytes).decode("utf-8")

        prompt = (
            "You are an expert speech-to-text transcription engine specialized in multilingual and Indian code-mixed speech.\n\n"
            "CRITICAL INSTRUCTIONS FOR TANGLISH, HINGLISH, AND ENGLISH:\n"
            "1. TANGLISH (Tamil in English alphabet):\n"
            "   If the speaker speaks Tamil or code-mixed Tamil (e.g. 'Enna panra', 'let us go', 'semma comedy bro', 'romba nalla irukku', 'enna visayam'), "
            "   ALWAYS transcribe it phonetically in English/Latin letters (Tanglish), e.g. 'Enna panra, let\\'s go'. "
            "   DO NOT convert into Tamil script.\n\n"
            "2. HINGLISH (Hindi in English alphabet):\n"
            "   If the speaker speaks Hindi or code-mixed Hindi (e.g. 'Kya kar raha hai', 'kya chal raha hai', 'bhai let\\'s go'), "
            "   ALWAYS transcribe it in English/Latin letters (Hinglish). "
            "   DO NOT convert into Devanagari script.\n\n"
            "3. ENGLISH:\n"
            "   If the speaker speaks English, transcribe in standard English.\n\n"
            "4. OUTPUT FORMAT:\n"
            "   Output ONLY the transcribed words verbatim without any quotes, timestamps, labels, or extra comments."
        )

        contents = [
            {
                "role": "user",
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": target_mime,
                            "data": b64_data,
                        }
                    },
                    {"text": prompt},
                ],
            }
        ]

        try:
            # Primary: dedicated Google transcription model (zero rate limit issues, South Asian code-switching)
            service = GeminiService(model="gemini-3.5-transcribe")
            transcript, _ = await service.generate_content(
                contents,
                generation_config={"temperature": 0.1, "maxOutputTokens": 300},
            )
            clean_transcript = transcript.strip().strip('"').strip("'")
            if clean_transcript:
                logger.info(f"Transcription successful via gemini-3.5-transcribe: '{clean_transcript}'")
                return clean_transcript
        except Exception as e:
            logger.warning(f"Dedicated transcription model failed ({e}), falling back to standard flash...")

        try:
            # Secondary fallback
            fallback_service = GeminiService(model=settings.GEMINI_MODEL)
            transcript, _ = await fallback_service.generate_content(
                contents,
                generation_config={"temperature": 0.1, "maxOutputTokens": 300},
            )
            clean_transcript = transcript.strip().strip('"').strip("'")
            logger.info(f"Transcription successful via fallback {settings.GEMINI_MODEL}: '{clean_transcript}'")
            return clean_transcript
        except Exception as e:
            logger.error(f"Error during audio transcription fallback: {e}", exc_info=True)
            return ""


web_search_service = WebSearchService()
