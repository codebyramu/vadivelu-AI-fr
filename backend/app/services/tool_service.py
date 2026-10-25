"""Tool Registry and Execution Engine for Gemini function calling.

Allows Gemini to inspect available memes, query memories, and intelligently select
reactions based on real database records. Designed to be extensible for future tools.
"""

import json
import logging
from typing import Any, Callable, Coroutine, Dict, List, Optional

from app.services.meme_service import meme_service
from app.services.memory_service import memory_service

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


tool_registry = ToolRegistry()
