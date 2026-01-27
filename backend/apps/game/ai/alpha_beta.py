"""
Alpha-Beta pruning algorithm implementation.
"""
from typing import Optional, Tuple, List
from .base import BaseAI
from .evaluation import combined_evaluation
from ..engine.game_state import GameState
from ..engine.move import Move
from ..engine.rules import GameRules


class AlphaBetaAI(BaseAI):
    """Alpha-Beta pruning algorithm for Level 2-3 AI."""

    def __init__(self, depth: int = 4, **kwargs):
        super().__init__(depth=depth, **kwargs)
        self.pruned_nodes = 0

    def get_name(self) -> str:
        return "Alpha-Beta Pruning"

    def reset_stats(self) -> None:
        super().reset_stats()
        self.pruned_nodes = 0

    def get_stats(self) -> dict:
        stats = super().get_stats()
        stats['pruned_nodes'] = self.pruned_nodes
        return stats

    def get_best_move(self, state: GameState) -> Optional[Move]:
        """
        Find the best move using Alpha-Beta pruning.

        Args:
            state: Current game state

        Returns:
            Best move found
        """
        self.reset_stats()
        _, best_move = self._alpha_beta(
            state,
            self.depth,
            float('-inf'),
            float('inf'),
            True,
            state.current_player
        )
        return best_move

    def _order_moves(self, state: GameState, moves: List[Move]) -> List[Move]:
        """
        Order moves for better pruning (captures first).

        Args:
            state: Current game state
            moves: List of moves to order

        Returns:
            Ordered list of moves
        """
        # Prioritize capture moves
        captures = [m for m in moves if m.is_capture()]
        non_captures = [m for m in moves if not m.is_capture()]
        return captures + non_captures

    def _alpha_beta(
        self,
        state: GameState,
        depth: int,
        alpha: float,
        beta: float,
        is_maximizing: bool,
        original_player: int
    ) -> Tuple[float, Optional[Move]]:
        """
        Alpha-Beta pruning recursive algorithm.

        Args:
            state: Current game state
            depth: Remaining search depth
            alpha: Alpha value (best for maximizer)
            beta: Beta value (best for minimizer)
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

        # Order moves for better pruning
        ordered_moves = self._order_moves(state, valid_moves)
        best_move = ordered_moves[0]

        if is_maximizing:
            max_eval = float('-inf')
            for move in ordered_moves:
                new_state = state.apply_move(move)
                eval_score, _ = self._alpha_beta(
                    new_state,
                    depth - 1,
                    alpha,
                    beta,
                    False,
                    original_player
                )
                if eval_score > max_eval:
                    max_eval = eval_score
                    best_move = move
                alpha = max(alpha, eval_score)
                if beta <= alpha:
                    self.pruned_nodes += 1
                    break  # Beta cutoff
            return max_eval, best_move
        else:
            min_eval = float('inf')
            for move in ordered_moves:
                new_state = state.apply_move(move)
                eval_score, _ = self._alpha_beta(
                    new_state,
                    depth - 1,
                    alpha,
                    beta,
                    True,
                    original_player
                )
                if eval_score < min_eval:
                    min_eval = eval_score
                    best_move = move
                beta = min(beta, eval_score)
                if beta <= alpha:
                    self.pruned_nodes += 1
                    break  # Alpha cutoff
            return min_eval, best_move
