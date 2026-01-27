"""
Base AI class for Stranger Things AI Game.
"""
import random
from abc import ABC, abstractmethod
from typing import Optional
from ..engine.game_state import GameState
from ..engine.move import Move
from ..engine.rules import GameRules


class BaseAI(ABC):
    """Abstract base class for all AI implementations."""

    def __init__(self, depth: int = 4, time_limit: Optional[float] = None, blunder_chance: float = 0.0):
        """
        Initialize AI.

        Args:
            depth: Search depth for tree-based algorithms
            time_limit: Optional time limit in seconds
            blunder_chance: Probability (0.0-1.0) of making a random move instead of optimal
        """
        self.depth = depth
        self.time_limit = time_limit
        self.blunder_chance = blunder_chance
        self.nodes_evaluated = 0

    def get_best_move(self, state: GameState) -> Optional[Move]:
        """
        Calculate and return the best move for the current state.
        May intentionally make a suboptimal move based on blunder_chance.

        Args:
            state: Current game state

        Returns:
            Best move, or None if no moves available
        """
        # Check for blunder (random move)
        if self.blunder_chance > 0 and random.random() < self.blunder_chance:
            valid_moves = GameRules.get_valid_moves(state, state.current_player)
            if valid_moves:
                return random.choice(valid_moves)
            return None

        # Otherwise calculate the optimal move
        return self._calculate_best_move(state)

    @abstractmethod
    def _calculate_best_move(self, state: GameState) -> Optional[Move]:
        """
        Calculate and return the best move for the current state (actual algorithm).

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
