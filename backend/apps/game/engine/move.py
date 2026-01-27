"""
Move representation for Stranger Things AI Game.
"""
from dataclasses import dataclass
from typing import Optional
from .board import Position


@dataclass
class Move:
    """Represents a game move."""
    from_pos: Position
    to_pos: Position
    captured: Optional[Position] = None

    def to_dict(self) -> dict:
        """Convert move to dictionary."""
        return {
            "from": self.from_pos.to_dict(),
            "to": self.to_pos.to_dict(),
            "captured": self.captured.to_dict() if self.captured else None
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'Move':
        """Create move from dictionary."""
        return cls(
            from_pos=Position.from_dict(data['from']),
            to_pos=Position.from_dict(data['to']),
            captured=Position.from_dict(data['captured']) if data.get('captured') else None
        )

    def is_capture(self) -> bool:
        """Check if this move captures a piece."""
        return self.captured is not None

    def __eq__(self, other) -> bool:
        if not isinstance(other, Move):
            return False
        return (
            self.from_pos == other.from_pos and
            self.to_pos == other.to_pos and
            self.captured == other.captured
        )

    def __hash__(self) -> int:
        captured_hash = hash(self.captured) if self.captured else 0
        return hash((hash(self.from_pos), hash(self.to_pos), captured_hash))

    def __repr__(self) -> str:
        capture_str = f" x{self.captured}" if self.captured else ""
        return f"Move({self.from_pos} -> {self.to_pos}{capture_str})"
