"""
Minimax algorithm implementation.
"""
from typing import Optional, Tuple
from .base import BaseAI
from .evaluation import combined_evaluation
from ..engine.game_state import GameState
from ..engine.move import Move
from ..engine.rules import GameRules
from ..engine.constants import PieceType


class MinimaxAI(BaseAI):
    """Minimax algorithm implementation for Level 1 AI (Demogorgon)."""

    def get_name(self) -> str:
        return "Minimax"

    def get_best_move(self, state: GameState) -> Optional[Move]:
        """
        Find the best move using Minimax algorithm.

        Args:
            state: Current game state

        Returns:
            Best move found
        """
        self.reset_stats()
        _, best_move = self._minimax(
            state,
            self.depth,
            True,
            state.current_player
        )
        return best_move

    def _minimax(
        self,
        state: GameState,
        depth: int,
        is_maximizing: bool,
        original_player: int
    ) -> Tuple[float, Optional[Move]]:
        """
        Minimax recursive algorithm.

        Args:
            state: Current game state
            depth: Remaining search depth
            is_maximizing: True if maximizing, False if minimizing
            original_player: The player we're finding the best move for

        Returns:
            Tuple of (evaluation score, best move)
        """
        self.nodes_evaluated += 1

        # Terminal conditions
        if depth == 0 or GameRules.is_game_over(state):
            return combined_evaluation(state, original_player), None

        valid_moves = GameRules.get_valid_moves(state)
        if not valid_moves:
            return combined_evaluation(state, original_player), None

        best_move = None

        if is_maximizing:
            max_eval = float('-inf')
            for move in valid_moves:
                new_state = state.apply_move(move)
                eval_score, _ = self._minimax(
                    new_state,
                    depth - 1,
                    False,
                    original_player
                )
                if eval_score > max_eval:
                    max_eval = eval_score
                    best_move = move
            return max_eval, best_move
        else:
            min_eval = float('inf')
            for move in valid_moves:
                new_state = state.apply_move(move)
                eval_score, _ = self._minimax(
                    new_state,
                    depth - 1,
                    True,
                    original_player
                )
                if eval_score < min_eval:
                    min_eval = eval_score
                    best_move = move
            return min_eval, best_move
