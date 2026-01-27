"""
Pytest configuration and fixtures.
"""
import pytest
from apps.game.engine import Board, GameState, Position, PieceType


@pytest.fixture
def empty_board():
    """Create an empty 5x5 board."""
    return Board(size=5)


@pytest.fixture
def initial_board():
    """Create a board with initial piece placement."""
    return Board.create_initial_board(5)


@pytest.fixture
def initial_game_state():
    """Create an initial game state."""
    return GameState.create_initial_state(5)


@pytest.fixture
def simple_game_state():
    """Create a simple game state for testing."""
    board = Board(size=5)
    board.set_piece(Position(2, 0), PieceType.PLAYER_ONE)
    board.set_piece(Position(2, 4), PieceType.PLAYER_TWO)
    return GameState(
        board=board,
        current_player=PieceType.PLAYER_ONE
    )
