"""Persistent Memory System for extracting facts and contextual callbacks."""

import re
from typing import Any, Dict, List, Optional, Tuple

from app.db.database import db_service


class MemoryService:
    """Manages long-term memories, user facts, and contextual callbacks."""

    # Heuristic patterns to extract user facts if LLM does not return any
    FACT_PATTERNS = [
        (
            r"\b(?:i(?:'m| am| was)?\s+training\s+(?:for|to)\s+)([^.,!?;]+)",
            "user_training",
            "User is training for {}",
        ),
        (
            r"\b(?:i(?:'m| am| was)?\s+preparing\s+(?:for|to)\s+)([^.,!?;]+)",
            "user_goal",
            "User is preparing for {}",
        ),
        (
            r"\b(?:i\s+work\s+(?:as|at|in)\s+)([^.,!?;]+)",
            "user_profession",
            "User works at/as {}",
        ),
        (
            r"\b(?:i(?:'m| am)\s+a\s+)(programmer|developer|engineer|designer|doctor|student|runner|athlete|teacher|writer|photographer)\b",
            "user_profession",
            "User is a {}",
        ),
        (
            r"\b(?:i\s+(?:love|really like|enjoy)\s+)([^.,!?;]+)",
            "user_interest",
            "User enjoys {}",
        ),
        (
            r"\b(?:my\s+goal\s+is\s+(?:to\s+)?)([^.,!?;]+)",
            "user_goal",
            "User's goal is to {}",
        ),
        (
            r"\b(?:i\s+(?:bought|purchased|got)\s+(?:a|an)\s+)([^.,!?;]+)",
            "user_purchase",
            "User recently got a {}",
        ),
        (
            r"\b(?:my\s+(?:dog|cat|pet)(?:'s)?\s+(?:name\s+is\s+)?)([^.,!?;]+)",
            "user_pet",
            "User has a pet {}",
        ),
    ]

    async def list_memories(
        self, search: Optional[str] = None, active_only: bool = True
    ) -> List[Dict[str, Any]]:
        return await db_service.list_memories(search=search, active_only=active_only)

    async def get_memory(self, mem_id: str) -> Optional[Dict[str, Any]]:
        memories = await db_service.list_memories(active_only=False)
        for m in memories:
            if m["id"] == mem_id:
                return m
        return None

    async def create_memory(
        self, key: str, content: str, source_conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        return await db_service.create_memory(
            key=key, content=content, source_conversation_id=source_conversation_id
        )

    async def update_memory(
        self,
        mem_id: str,
        key: Optional[str] = None,
        content: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        return await db_service.update_memory(
            mem_id=mem_id, key=key, content=content, is_active=is_active
        )

    async def delete_memory(self, mem_id: str) -> bool:
        return await db_service.delete_memory(mem_id)

    async def clear_all(self) -> int:
        return await db_service.clear_all_memories()

    def extract_heuristics(
        self, text: str
    ) -> List[Tuple[str, str]]:
        """Extract user facts using regex heuristics."""
        extracted = []
        lower = text.strip()
        for pattern, key, template in self.FACT_PATTERNS:
            match = re.search(pattern, lower, re.IGNORECASE)
            if match:
                value = match.group(1).strip()
                # Clean up extracted value
                value = re.sub(r"\s+", " ", value)
                if len(value) >= 3 and len(value) <= 80:
                    content = template.format(value)
                    extracted.append((key, content))
        return extracted

    async def record_user_facts(
        self, text: str, source_conv_id: Optional[str] = None
    ) -> List[str]:
        """Automatically detect facts and save them to persistent memory."""
        facts = self.extract_heuristics(text)
        created_keys = []
        for key, content in facts:
            await self.create_memory(key, content, source_conv_id)
            created_keys.append(key)
        return created_keys

    def format_memories_for_prompt(self, memories: List[Dict[str, Any]]) -> str:
        """Format active memories for injection into the Reaction Director prompt."""
        if not memories:
            return "No prior user memories recorded."

        lines = ["[RECALLED USER MEMORIES & PERSONAL CONTEXT]:"]
        for m in memories:
            lines.append(f"- {m['key']}: {m['content']}")
        lines.append(
            "(Callback Guideline: Naturally weave these user details into your response with comedic or supportive callbacks when appropriate!)"
        )
        return "\n".join(lines)


memory_service = MemoryService()
