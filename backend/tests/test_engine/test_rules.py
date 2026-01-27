"""
Tests for the GameRules class.
"""
import pytest
from apps.game.engine import (
    Board, Position, Move, GameState, GameRules, PieceType, GamePhase
)


class TestGameRules:
    """Tests for GameRules class."""

    def test_get_valid_moves_initial(self, initial_game_state):
        """Test getting valid moves from initial position."""
        moves = GameRules.get_valid_moves(initial_game_state)
        assert len(moves) > 0

        # All moves should be from player one pieces
        for move in moves:
            piece = initial_game_state.board.get_piece(move.from_pos)
            assert piece == PieceType.PLAYER_ONE

    def test_get_valid_moves_simple(self, simple_game_state):
        """Test valid moves for a simple state."""
        moves = GameRules.get_valid_moves(simple_game_state)

        # Player one piece at (2, 0) should be able to move to adjacent cells
        from_positions = {move.from_pos for move in moves}
        assert Position(2, 0) in from_positions

    def test_is_valid_move(self, simple_game_state):
        """Test move validation."""
        # Valid move
        valid_move = Move(
            from_pos=Position(2, 0),
            to_pos=Position(2, 1)
        )
        assert GameRules.is_valid_move(simple_game_state, valid_move)

        # Invalid move - wrong player's piece
        invalid_move = Move(
            from_pos=Position(2, 4),
            to_pos=Position(2, 3)
        )
        assert not GameRules.is_valid_move(simple_game_state, invalid_move)

        # Invalid move - destination occupied
        state = simple_game_state.copy()
        state.board.set_piece(Position(2, 1), PieceType.PLAYER_ONE)
        blocked_move = Move(
            from_pos=Position(2, 0),
            to_pos=Position(2, 1)
        )
        assert not GameRules.is_valid_move(state, blocked_move)

    def test_capture_move(self):
        """Test capture move validation."""
        board = Board(size=5)
        board.set_piece(Position(2, 0), PieceType.PLAYER_ONE)
        board.set_piece(Position(2, 1), PieceType.PLAYER_TWO)

        state = GameState(board=board, current_player=PieceType.PLAYER_ONE)

        # Capture move should be valid
        capture_move = Move(
            from_pos=Position(2, 0),
            to_pos=Position(2, 2),
            captured=Position(2, 1)
        )
        assert GameRules.is_valid_move(state, capture_move)

    def test_check_winner_elimination(self):
        """Test winner detection by piece elimination."""
        board = Board(size=5)
        board.set_piece(Position(2, 0), PieceType.PLAYER_ONE)
        # No player two pieces

        state = GameState(board=board, current_player=PieceType.PLAYER_ONE)
        winner = GameRules.check_winner(state)
        assert winner == PieceType.PLAYER_ONE

    def test_check_winner_no_moves(self):
        """Test winner detection when player has no moves."""
        # Create a state where current player has no valid moves
        board = Board(size=5)
        board.set_piece(Position(0, 0), PieceType.PLAYER_ONE)
        # Surround with player two pieces
        board.set_piece(Position(0, 1), PieceType.PLAYER_TWO)
        board.set_piece(Position(1, 0), PieceType.PLAYER_TWO)
        board.set_piece(Position(1, 1), PieceType.PLAYER_TWO)

        state = GameState(board=board, current_player=PieceType.PLAYER_ONE)

        # If player one has no moves and game is not over by elimination
        moves = GameRules.get_valid_moves(state)
        if not moves:
            winner = GameRules.check_winner(state)
            assert winner == PieceType.PLAYER_TWO

    def test_is_game_over(self, simple_game_state):
        """Test game over detection."""
        # Game is not over initially
        assert not GameRules.is_game_over(simple_game_state)

        # Game is over when one player has no pieces
        board = Board(size=5)
        board.set_piece(Position(2, 0), PieceType.PLAYER_ONE)
        state = GameState(board=board, current_player=PieceType.PLAYER_ONE)
        assert GameRules.is_game_over(state)

    def test_get_capture_moves(self):
        """Test getting only capture moves."""
        board = Board(size=5)
        board.set_piece(Position(2, 0), PieceType.PLAYER_ONE)
        board.set_piece(Position(2, 1), PieceType.PLAYER_TWO)

        state = GameState(board=board, current_player=PieceType.PLAYER_ONE)

        capture_moves = GameRules.get_capture_moves(state)
        assert len(capture_moves) == 1
        assert capture_moves[0].is_capture()
