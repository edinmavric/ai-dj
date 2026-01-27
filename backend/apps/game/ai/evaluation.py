"""
Board evaluation functions for AI algorithms.
"""
from typing import Callable
from ..engine.game_state import GameState
from ..engine.board import Position
from ..engine.constants import PieceType

# Type alias for evaluation functions
EvaluationFunction = Callable[[GameState, int], float]


def piece_count_evaluation(state: GameState, player: int) -> float:
    """
    Simple evaluation based on piece count difference.

    Args:
        state: Current game state
        player: Player to evaluate for

    Returns:
        Score based on piece difference
    """
    board = state.board
    opponent = PieceType.PLAYER_TWO if player == PieceType.PLAYER_ONE else PieceType.PLAYER_ONE

    player_pieces = board.count_pieces(player)
    opponent_pieces = board.count_pieces(opponent)

    return float(player_pieces - opponent_pieces)


def positional_evaluation(state: GameState, player: int) -> float:
    """
    Evaluation considering piece positions (center control).

    Pieces closer to the center are valued higher.

    Args:
        state: Current game state
        player: Player to evaluate for

    Returns:
        Positional score
    """
    board = state.board
    center = board.size / 2
    score = 0.0
    opponent = PieceType.PLAYER_TWO if player == PieceType.PLAYER_ONE else PieceType.PLAYER_ONE

    for row in range(board.size):
        for col in range(board.size):
            piece = board.grid[row][col]
            if piece == PieceType.EMPTY:
                continue

            # Distance from center (lower is better)
            dist = abs(row - center) + abs(col - center)
            positional_value = (board.size - dist) * 0.1

            if piece == player:
                score += 1 + positional_value
            else:
                score -= 1 + positional_value

    return score


def mobility_evaluation(state: GameState, player: int) -> float:
    """
    Evaluation based on mobility (number of available moves).

    More moves = more options = better position.

    Args:
        state: Current game state
        player: Player to evaluate for

    Returns:
        Mobility score
    """
    from ..engine.rules import GameRules

    # Get moves for current player
    if state.current_player == player:
        player_moves = len(GameRules.get_valid_moves(state))
    else:
        # Create temporary state to count moves
        temp_state = GameState(
            board=state.board.copy(),
            current_player=player,
            phase=state.phase,
            move_history=state.move_history
        )
        player_moves = len(GameRules.get_valid_moves(temp_state))

    # Get moves for opponent
    opponent = PieceType.PLAYER_TWO if player == PieceType.PLAYER_ONE else PieceType.PLAYER_ONE
    if state.current_player == opponent:
        opponent_moves = len(GameRules.get_valid_moves(state))
    else:
        temp_state = GameState(
            board=state.board.copy(),
            current_player=opponent,
            phase=state.phase,
            move_history=state.move_history
        )
        opponent_moves = len(GameRules.get_valid_moves(temp_state))

    return float(player_moves - opponent_moves) * 0.5


def capture_opportunity_evaluation(state: GameState, player: int) -> float:
    """
    Evaluation based on capture opportunities.

    More capture moves = more aggressive position.

    Args:
        state: Current game state
        player: Player to evaluate for

    Returns:
        Capture opportunity score
    """
    from ..engine.rules import GameRules

    if state.current_player == player:
        captures = len(GameRules.get_capture_moves(state))
    else:
        temp_state = GameState(
            board=state.board.copy(),
            current_player=player,
            phase=state.phase,
            move_history=state.move_history
        )
        captures = len(GameRules.get_capture_moves(temp_state))

    return float(captures) * 2.0


def combined_evaluation(state: GameState, player: int) -> float:
    """
    Combined evaluation function using multiple heuristics.

    Args:
        state: Current game state
        player: Player to evaluate for

    Returns:
        Combined weighted score
    """
    from ..engine.rules import GameRules

    # Check for terminal states
    winner = GameRules.check_winner(state)
    if winner is not None:
        if winner == player:
            return 1000.0  # Win
        else:
            return -1000.0  # Loss

    # Combine heuristics with weights
    score = (
        piece_count_evaluation(state, player) * 10.0 +
        positional_evaluation(state, player) * 3.0 +
        mobility_evaluation(state, player) * 2.0 +
        capture_opportunity_evaluation(state, player) * 1.5
    )

    return score
