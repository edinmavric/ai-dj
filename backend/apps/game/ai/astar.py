"""
A* pathfinding algorithm for tactical move selection.
"""
from typing import Optional, List, Set, Tuple
from dataclasses import dataclass, field
import heapq
from .base import BaseAI
from ..engine.game_state import GameState
from ..engine.move import Move
from ..engine.board import Board, Position
from ..engine.rules import GameRules
from ..engine.constants import PieceType


@dataclass(order=True)
class AStarNode:
    """Node for A* pathfinding."""
    f_score: float
    g_score: float = field(compare=False)
    position: Position = field(compare=False)
    parent: Optional['AStarNode'] = field(compare=False, default=None)


class AStarAI(BaseAI):
    """A* pathfinding for tactical move selection."""

    def get_name(self) -> str:
        return "A* Pathfinding"

    def get_best_move(self, state: GameState) -> Optional[Move]:
        """
        Use A* to find moves that lead pieces toward opponents.

        Prioritizes capture moves, then uses A* to find
        the best move toward the nearest opponent.

        Args:
            state: Current game state

        Returns:
            Best tactical move
        """
        self.reset_stats()

        valid_moves = GameRules.get_valid_moves(state)
        if not valid_moves:
            return None

        # Prioritize capture moves
        capture_moves = [m for m in valid_moves if m.is_capture()]
        if capture_moves:
            self.nodes_evaluated += 1
            return capture_moves[0]

        # Find opponent positions
        opponent = state.get_opponent(state.current_player)
        opponent_positions = state.board.get_piece_positions(opponent)

        if not opponent_positions:
            return valid_moves[0]

        # Use A* to find best move toward nearest opponent
        best_move = None
        best_score = float('inf')

        for move in valid_moves:
            self.nodes_evaluated += 1

            # Calculate minimum distance to any opponent after this move
            min_dist = min(
                self._heuristic(move.to_pos, opp_pos)
                for opp_pos in opponent_positions
            )

            if min_dist < best_score:
                best_score = min_dist
                best_move = move

        return best_move or valid_moves[0]

    def _heuristic(self, pos1: Position, pos2: Position) -> float:
        """
        Manhattan distance heuristic.

        Args:
            pos1: First position
            pos2: Second position

        Returns:
            Manhattan distance
        """
        return abs(pos1.row - pos2.row) + abs(pos1.col - pos2.col)

    def find_path(
        self,
        board: Board,
        start: Position,
        goal: Position
    ) -> List[Position]:
        """
        Find shortest path from start to goal using A*.

        Args:
            board: Game board
            start: Starting position
            goal: Goal position

        Returns:
            List of positions forming the path
        """
        open_set: List[AStarNode] = []
        closed_set: Set[Tuple[int, int]] = set()

        start_node = AStarNode(
            f_score=self._heuristic(start, goal),
            g_score=0,
            position=start
        )
        heapq.heappush(open_set, start_node)

        while open_set:
            current = heapq.heappop(open_set)
            self.nodes_evaluated += 1

            if current.position == goal:
                return self._reconstruct_path(current)

            closed_set.add((current.position.row, current.position.col))

            for neighbor_pos in self._get_neighbors(board, current.position):
                if (neighbor_pos.row, neighbor_pos.col) in closed_set:
                    continue

                g_score = current.g_score + 1
                f_score = g_score + self._heuristic(neighbor_pos, goal)

                neighbor = AStarNode(
                    f_score=f_score,
                    g_score=g_score,
                    position=neighbor_pos,
                    parent=current
                )
                heapq.heappush(open_set, neighbor)

        return []  # No path found

    def _get_neighbors(self, board: Board, pos: Position) -> List[Position]:
        """
        Get valid neighboring positions (empty cells).

        Args:
            board: Game board
            pos: Current position

        Returns:
            List of valid neighbor positions
        """
        neighbors = []
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]

        for dr, dc in directions:
            new_pos = Position(pos.row + dr, pos.col + dc)
            if new_pos.is_valid(board.size) and board.is_empty(new_pos):
                neighbors.append(new_pos)

        return neighbors

    def _reconstruct_path(self, node: AStarNode) -> List[Position]:
        """
        Reconstruct path from goal to start.

        Args:
            node: Final node in path

        Returns:
            List of positions from start to goal
        """
        path = []
        current = node

        while current is not None:
            path.append(current.position)
            current = current.parent

        return list(reversed(path))
