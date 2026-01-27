"""
Monte Carlo Tree Search algorithm implementation.
"""
import math
import random
from typing import Optional, List
from dataclasses import dataclass, field
from .base import BaseAI
from ..engine.game_state import GameState
from ..engine.move import Move
from ..engine.rules import GameRules
from ..engine.constants import PieceType


@dataclass
class MCTSNode:
    """Node in the MCTS tree."""
    state: GameState
    parent: Optional['MCTSNode'] = None
    move: Optional[Move] = None
    children: List['MCTSNode'] = field(default_factory=list)
    visits: int = 0
    wins: float = 0.0
    untried_moves: List[Move] = field(default_factory=list)

    def __post_init__(self):
        if not self.untried_moves:
            self.untried_moves = GameRules.get_valid_moves(self.state)

    @property
    def ucb1(self) -> float:
        """Calculate UCB1 value for node selection."""
        if self.visits == 0:
            return float('inf')
        if self.parent is None or self.parent.visits == 0:
            return self.wins / self.visits

        exploitation = self.wins / self.visits
        exploration = math.sqrt(2 * math.log(self.parent.visits) / self.visits)
        return exploitation + exploration

    def best_child(self, exploration_weight: float = 1.414) -> 'MCTSNode':
        """Select the child with highest UCB1 value."""
        if not self.children:
            raise ValueError("No children to select from")

        def ucb1_score(child: 'MCTSNode') -> float:
            if child.visits == 0:
                return float('inf')
            exploitation = child.wins / child.visits
            exploration = exploration_weight * math.sqrt(
                math.log(self.visits) / child.visits
            )
            return exploitation + exploration

        return max(self.children, key=ucb1_score)

    def is_fully_expanded(self) -> bool:
        """Check if all moves have been tried."""
        return len(self.untried_moves) == 0

    def is_terminal(self) -> bool:
        """Check if this is a terminal node."""
        return GameRules.is_game_over(self.state)


class MCTSAI(BaseAI):
    """Monte Carlo Tree Search implementation for Level 4 AI (Mind Flayer)."""

    def __init__(self, iterations: int = 1000, **kwargs):
        """
        Initialize MCTS AI.

        Args:
            iterations: Number of MCTS iterations to perform
        """
        super().__init__(**kwargs)
        self.iterations = iterations
        self.simulations_run = 0

    def get_name(self) -> str:
        return "Monte Carlo Tree Search"

    def reset_stats(self) -> None:
        super().reset_stats()
        self.simulations_run = 0

    def get_stats(self) -> dict:
        stats = super().get_stats()
        stats['iterations'] = self.iterations
        stats['simulations_run'] = self.simulations_run
        return stats

    def _calculate_best_move(self, state: GameState) -> Optional[Move]:
        """
        Find the best move using MCTS.

        Args:
            state: Current game state

        Returns:
            Best move found
        """
        self.reset_stats()
        root = MCTSNode(state=state)

        for _ in range(self.iterations):
            # Selection
            node = self._select(root)

            # Expansion
            if not node.is_terminal() and not node.is_fully_expanded():
                node = self._expand(node)

            # Simulation
            result = self._simulate(node.state)
            self.simulations_run += 1

            # Backpropagation
            self._backpropagate(node, result, state.current_player)
            self.nodes_evaluated += 1

        # Return move of child with most visits (most robust choice)
        if not root.children:
            valid_moves = GameRules.get_valid_moves(state)
            return valid_moves[0] if valid_moves else None

        best_child = max(root.children, key=lambda c: c.visits)
        return best_child.move

    def _select(self, node: MCTSNode) -> MCTSNode:
        """
        Selection phase: traverse tree using UCB1.

        Args:
            node: Starting node

        Returns:
            Selected node for expansion/simulation
        """
        while not node.is_terminal():
            if not node.is_fully_expanded():
                return node
            if not node.children:
                return node
            node = node.best_child()
        return node

    def _expand(self, node: MCTSNode) -> MCTSNode:
        """
        Expansion phase: add a new child node.

        Args:
            node: Node to expand

        Returns:
            New child node
        """
        if not node.untried_moves:
            return node

        move = node.untried_moves.pop()
        new_state = node.state.apply_move(move)
        child = MCTSNode(state=new_state, parent=node, move=move)
        node.children.append(child)
        return child

    def _simulate(self, state: GameState) -> Optional[int]:
        """
        Simulation phase: random playout to terminal state.

        Args:
            state: Starting state for simulation

        Returns:
            Winner of the simulation (or None for draw)
        """
        current_state = state
        max_moves = 100  # Prevent infinite loops

        for _ in range(max_moves):
            if GameRules.is_game_over(current_state):
                break

            valid_moves = GameRules.get_valid_moves(current_state)
            if not valid_moves:
                break

            # Random move selection (could be improved with heuristics)
            move = random.choice(valid_moves)
            current_state = current_state.apply_move(move)

        return GameRules.check_winner(current_state)

    def _backpropagate(
        self,
        node: MCTSNode,
        result: Optional[int],
        original_player: int
    ) -> None:
        """
        Backpropagation phase: update statistics.

        In MCTS, each node's win count represents how good the move was
        for the player who made it. The player who moved to reach a node
        is the opponent of node.state.current_player (since turns alternate).

        Args:
            node: Starting node for backpropagation
            result: Winner of the simulation
            original_player: Player we're optimizing for (unused but kept for API)
        """
        while node is not None:
            node.visits += 1

            if result is None:
                # Draw - add 0.5 for both players
                node.wins += 0.5
            else:
                # The player who made the move to reach this node is the
                # opponent of the current player (since turns alternate)
                player_who_moved_here = 3 - node.state.current_player
                if result == player_who_moved_here:
                    node.wins += 1.0
            # Loss: add 0 (do nothing)

            node = node.parent
