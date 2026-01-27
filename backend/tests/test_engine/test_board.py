"""
Tests for the Board class.
"""
import pytest
from apps.game.engine import Board, Position, PieceType


class TestPosition:
    """Tests for Position class."""

    def test_position_creation(self):
        """Test position creation."""
        pos = Position(2, 3)
        assert pos.row == 2
        assert pos.col == 3

    def test_position_to_dict(self):
        """Test position to dictionary conversion."""
        pos = Position(2, 3)
        d = pos.to_dict()
        assert d == {'row': 2, 'col': 3}

    def test_position_from_dict(self):
        """Test position from dictionary creation."""
        pos = Position.from_dict({'row': 2, 'col': 3})
        assert pos.row == 2
        assert pos.col == 3

    def test_position_is_valid(self):
        """Test position validation."""
        assert Position(0, 0).is_valid(5)
        assert Position(4, 4).is_valid(5)
        assert not Position(-1, 0).is_valid(5)
        assert not Position(5, 0).is_valid(5)
        assert not Position(0, 5).is_valid(5)

    def test_position_equality(self):
        """Test position equality."""
        pos1 = Position(2, 3)
        pos2 = Position(2, 3)
        pos3 = Position(3, 2)
        assert pos1 == pos2
        assert pos1 != pos3


class TestBoard:
    """Tests for Board class."""

    def test_board_creation_default(self):
        """Test default board creation."""
        board = Board(size=5)
        assert board.size == 5
        assert len(board.grid) == 5
        assert all(len(row) == 5 for row in board.grid)
        assert all(cell == PieceType.EMPTY for row in board.grid for cell in row)

    def test_board_creation_invalid_size(self):
        """Test board creation with invalid size."""
        with pytest.raises(ValueError):
            Board(size=3)
        with pytest.raises(ValueError):
            Board(size=10)

    def test_board_get_set_piece(self):
        """Test getting and setting pieces."""
        board = Board(size=5)
        pos = Position(2, 3)
        board.set_piece(pos, PieceType.PLAYER_ONE)
        assert board.get_piece(pos) == PieceType.PLAYER_ONE

    def test_board_is_empty(self):
        """Test checking if position is empty."""
        board = Board(size=5)
        pos = Position(2, 3)
        assert board.is_empty(pos)
        board.set_piece(pos, PieceType.PLAYER_ONE)
        assert not board.is_empty(pos)

    def test_board_copy(self):
        """Test board copying."""
        board = Board(size=5)
        pos = Position(2, 3)
        board.set_piece(pos, PieceType.PLAYER_ONE)

        board_copy = board.copy()
        assert board_copy.get_piece(pos) == PieceType.PLAYER_ONE

        # Modify original, copy should be unchanged
        board.set_piece(pos, PieceType.EMPTY)
        assert board_copy.get_piece(pos) == PieceType.PLAYER_ONE

    def test_board_count_pieces(self):
        """Test piece counting."""
        board = Board(size=5)
        board.set_piece(Position(0, 0), PieceType.PLAYER_ONE)
        board.set_piece(Position(0, 1), PieceType.PLAYER_ONE)
        board.set_piece(Position(0, 2), PieceType.PLAYER_TWO)

        assert board.count_pieces(PieceType.PLAYER_ONE) == 2
        assert board.count_pieces(PieceType.PLAYER_TWO) == 1
        assert board.count_pieces(PieceType.EMPTY) == 22

    def test_board_initial_placement(self):
        """Test initial board setup."""
        board = Board.create_initial_board(5)

        # Check player one pieces on left column
        assert board.get_piece(Position(0, 0)) == PieceType.PLAYER_ONE
        assert board.get_piece(Position(1, 0)) == PieceType.PLAYER_ONE
        assert board.get_piece(Position(2, 0)) == PieceType.EMPTY  # Middle row empty
        assert board.get_piece(Position(3, 0)) == PieceType.PLAYER_ONE
        assert board.get_piece(Position(4, 0)) == PieceType.PLAYER_ONE

        # Check player two pieces on right column
        assert board.get_piece(Position(0, 4)) == PieceType.PLAYER_TWO
        assert board.get_piece(Position(4, 4)) == PieceType.PLAYER_TWO

    def test_board_to_dict_from_dict(self):
        """Test board serialization."""
        board = Board.create_initial_board(5)
        d = board.to_dict()
        board2 = Board.from_dict(d)

        assert board.size == board2.size
        assert board.grid == board2.grid
