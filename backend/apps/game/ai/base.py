"""
Base AI class for Stranger Things AI Game.
"""
from abc import ABC, abstractmethod
from typing import Optional
from ..engine.game_state import GameState
from ..engine.move import Move


class BaseAI(ABC):
    """Abstract base class for all AI implementations."""

    def __init__(self, depth: int = 4, time_limit: Optional[float] = None):
        """
        Initialize AI.

        Args:
            depth: Search depth for tree-based algorithms
            time_limit: Optional time limit in seconds
        """
        self.depth = depth
        self.time_limit = time_limit
        self.nodes_evaluated = 0

    @abstractmethod
    def get_best_move(self, state: GameState) -> Optional[Move]:
        """
        Calculate and return the best move for the current state.

        Args:
            state: Current game state

        Returns:
            Best move, or None if no moves available
        """
        pass

    @abstractmethod
    def get_name(self) -> str:
        """Return the algorithm name."""
        pass

    def reset_stats(self) -> None:
        """Reset performance statistics."""
        self.nodes_evaluated = 0

    def get_stats(self) -> dict:
        """Get performance statistics."""
        return {
            'algorithm': self.get_name(),
            'nodes_evaluated': self.nodes_evaluated,
            'depth': self.depth
        }
