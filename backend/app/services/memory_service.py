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
            r"\b(?:i(?:'m| am)?\s+running\s+(?:a\s+)?)(marathon|competition|race|5k|10k)\b",
            "user_training",
            "User is running a {}",
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

    # Keywords associated with memory keys for intelligent context callbacks
    MEMORY_KEY_ASSOCIATIONS = {
        "user_training": ["run", "running", "marathon", "training", "exercise", "race", "competition", "gold medal", "trophy", "fast", "legs", "fitness", "track"],
        "user_profession": ["work", "job", "office", "code", "programming", "developer", "engineer", "software", "bug", "salary", "boss", "meeting", "company"],
        "user_pet": ["pet", "dog", "cat", "puppy", "kitten", "animal", "walk", "vet", "bark", "meow"],
        "user_goal": ["goal", "target", "dream", "achieve", "success", "future", "plan", "strive"],
        "user_interest": ["like", "love", "hobby", "enjoy", "fun", "passion", "music", "cinema", "movie"],
        "user_purchase": ["buy", "bought", "purchased", "got", "car", "phone", "crypto", "investment", "money", "spent"],
    }

    async def retrieve_relevant_memories(
        self, prompt: str, history: Optional[List[Dict[str, Any]]] = None, limit: int = 10
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Retrieve active memories and rank them by relevance to current conversation context.

        Returns:
            Tuple[List[Dict[str, Any]], List[str]]: (ranked_memories, highly_relevant_keys)
        """
        active = await self.list_memories(active_only=True)
        if not active:
            return [], []

        # Combine prompt and recent history
        combined_text = prompt.lower()
        if history:
            for h in history[-3:]:
                combined_text += " " + str(h.get("content", "")).lower()

        scored: List[Tuple[float, Dict[str, Any], bool]] = []
        highly_relevant_keys: List[str] = []

        for m in active:
            score = 1.0
            is_relevant = False
            k = m.get("key", "").lower()
            content = m.get("content", "").lower()

            # Check association triggers
            for assoc_key, trigger_words in self.MEMORY_KEY_ASSOCIATIONS.items():
                if assoc_key in k:
                    if any(tw in combined_text for tw in trigger_words):
                        score += 25.0
                        is_relevant = True
                        break

            # Check direct token overlap between memory content and prompt
            content_words = [w for w in re.findall(r"\w+", content) if len(w) > 3]
            for cw in content_words:
                if cw in combined_text:
                    score += 8.0
                    is_relevant = True

            if is_relevant and m["key"] not in highly_relevant_keys:
                highly_relevant_keys.append(m["key"])

            item_copy = dict(m)
            item_copy["isRelevant"] = is_relevant
            scored.append((score, item_copy, is_relevant))

        # Sort descending by relevance score
        scored.sort(key=lambda x: x[0], reverse=True)
        ranked = [item for _, item, _ in scored[:limit]]
        return ranked, highly_relevant_keys

    def format_memories_for_prompt(
        self, memories: List[Dict[str, Any]], relevant_keys: Optional[List[str]] = None
    ) -> str:
        """Format active memories for injection into the Reaction Director prompt with explicit callback mandates."""
        if not memories:
            return "No prior user memories recorded."

        rel_set = set(relevant_keys or [])
        lines = ["[RECALLED USER MEMORIES & PERSONAL CONTEXT]:"]
        for m in memories:
            k = m["key"]
            if k in rel_set or m.get("isRelevant"):
                lines.append(f"- {k}: {m['content']} [HIGH CONTEXT RELEVANCE TO CONVERSATION]")
            else:
                lines.append(f"- {k}: {m['content']}")

        if rel_set:
            lines.append(
                "(CALLBACK MANDATE: The user's message is directly connected to their personal memories above! Naturally weave a witty, supportive, or playful callback into your spoken dialogue about this!)"
            )
        else:
            lines.append(
                "(Callback Guideline: If appropriate, naturally weave these user details into your response with comedic or supportive callbacks!)"
            )
        return "\n".join(lines)


memory_service = MemoryService()
