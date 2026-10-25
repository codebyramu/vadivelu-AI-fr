"""Tool Registry and Execution Engine for Gemini function calling.

Allows Gemini to inspect available memes, query memories, search the live web,
fetch webpage contents/links, check weather, and calculate math expressions.
"""

import json
import logging
from typing import Any, Callable, Coroutine, Dict, List, Optional

from app.services.meme_service import meme_service
from app.services.memory_service import memory_service
from app.services.web_search_service import web_search_service

logger = logging.getLogger("vadivelu.tools")


# Gemini Function Declarations Schema (OpenAPI format compatible with Google Gemini)
TOOL_DECLARATIONS = [
    {
        "name": "search_meme_library",
        "description": "Searches the real meme library by topic keyword, emotion category, or context to find genuine meme clips, IDs, titles, and emotional tags.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {
                    "type": "STRING",
                    "description": "Keyword to search in meme title, tags, or context (e.g. 'champion', 'stocks', 'running', 'surprise').",
                },
                "emotion": {
                    "type": "STRING",
                    "description": "Emotion category to filter by: 'celebration', 'shock', 'irony', 'laughter', 'awkward', 'calm'.",
                },
            },
        },
    },
    {
        "name": "list_available_memes",
        "description": "Lists all currently active memes in the soundboard that are ready and not in cooldown.",
        "parameters": {
            "type": "OBJECT",
            "properties": {},
        },
    },
    {
        "name": "lookup_user_memories",
        "description": "Retrieves stored personal facts, hobbies, goals, and background details about the user for natural callbacks.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "topic": {
                    "type": "STRING",
                    "description": "Optional topic or keyword to search (e.g. 'work', 'pet', 'training', 'hobby').",
                },
            },
        },
    },
    {
        "name": "web_search",
        "description": "Performs a live web search for real-time information, news, current events, sports scores, celebrities, movies, or general knowledge.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {
                    "type": "STRING",
                    "description": "The search query (e.g. 'latest tech news', 'who won the marathon', 'Vadivelu latest movie').",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "fetch_webpage",
        "description": "Fetches and reads the body content and title of any URL or link shared by the user.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "url": {
                    "type": "STRING",
                    "description": "The full HTTP/HTTPS URL of the webpage to read (e.g. 'https://en.wikipedia.org/wiki/Vadivelu').",
                },
            },
            "required": ["url"],
        },
    },
    {
        "name": "lookup_weather",
        "description": "Retrieves current real-time weather and temperature for any city or location.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "location": {
                    "type": "STRING",
                    "description": "City or location name (e.g. 'Chennai', 'Madurai', 'London', 'New York').",
                },
            },
            "required": ["location"],
        },
    },
    {
        "name": "calculate_math",
        "description": "Safely evaluates math expressions, percentages, unit conversions, or arithmetic.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "expression": {
                    "type": "STRING",
                    "description": "Mathematical expression to evaluate (e.g. '25 * 14', 'sqrt(144) + 12', '15% of 850').",
                },
            },
            "required": ["expression"],
        },
    },
]


class ToolRegistry:
    """Manages tool declarations and execution for Gemini."""

    def __init__(self):
        self._tools: Dict[str, Callable[..., Coroutine[Any, Any, Any]]] = {}
        self._register_default_tools()

    def _register_default_tools(self):
        self._tools["search_meme_library"] = self._search_memes
        self._tools["list_available_memes"] = self._list_available_memes
        self._tools["lookup_user_memories"] = self._lookup_memories
        self._tools["web_search"] = self._web_search
        self._tools["fetch_webpage"] = self._fetch_webpage
        self._tools["lookup_weather"] = self._lookup_weather
        self._tools["calculate_math"] = self._calculate_math

    def register_tool(
        self, name: str, func: Callable[..., Coroutine[Any, Any, Any]]
    ) -> None:
        """Register a custom tool function for future capabilities."""
        self._tools[name] = func

    def get_gemini_tools_spec(self) -> List[Dict[str, Any]]:
        """Returns the tools specification formatted for Gemini API."""
        return [{"functionDeclarations": TOOL_DECLARATIONS}]

    async def execute_tool(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Executes a requested tool function with arguments."""
        if tool_name not in self._tools:
            logger.warning(f"Tool {tool_name} is not registered.")
            return {"error": f"Tool '{tool_name}' not found."}

        logger.info(f"Executing tool {tool_name} with args: {args}")
        try:
            handler = self._tools[tool_name]
            result = await handler(**args)
            return {"result": result}
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}", exc_info=True)
            return {"error": str(e)}

    async def _search_memes(
        self, query: Optional[str] = None, emotion: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Tool handler: search memes in database using intelligent fuzzy/semantic relevance ranking."""
        ranked = await meme_service.rank_dialogues(prompt=query, emotion=emotion, limit=15)
        return [
            {
                "memeId": m["id"],
                "title": m.get("lineText") or m.get("title", ""),
                "emotion": m.get("emotion", ""),
                "contextHint": m.get("lineTranslation") or m.get("contextHint", ""),
                "tags": m.get("tags", []),
                "relevanceScore": m.get("relevanceScore", 0.0),
                "isAvailableNow": m.get("isAvailableNow", True),
            }
            for m in ranked
            if m.get("isAvailableNow", True)
        ]

    async def _list_available_memes(self) -> List[Dict[str, Any]]:
        """Tool handler: list all ready memes."""
        available = await meme_service.get_available_memes()
        return [
            {
                "memeId": m["id"],
                "title": m["title"],
                "emotion": m["emotion"],
                "contextHint": m.get("contextHint", ""),
            }
            for m in available
        ]

    async def _lookup_memories(self, topic: Optional[str] = None) -> List[Dict[str, Any]]:
        """Tool handler: look up user memories."""
        return await memory_service.list_memories(search=topic, active_only=True)

    async def _web_search(self, query: str) -> List[Dict[str, Any]]:
        """Tool handler: search the live web."""
        return await web_search_service.search_web(query=query, max_results=5)

    async def _fetch_webpage(self, url: str) -> Dict[str, Any]:
        """Tool handler: fetch and read webpage contents."""
        return await web_search_service.fetch_webpage(url=url)

    async def _lookup_weather(self, location: str) -> Dict[str, Any]:
        """Tool handler: lookup current weather."""
        return await web_search_service.lookup_weather(location=location)

    async def _calculate_math(self, expression: str) -> Dict[str, Any]:
        """Tool handler: calculate math expression."""
        return web_search_service.calculate_math(expression=expression)


tool_registry = ToolRegistry()
