"""
Game rules and validation for Stranger Things AI Game.
"""
from typing import List, Optional
from .board import Board, Position
from .move import Move
from .game_state import GameState, GamePhase
from .constants import PieceType, Direction


class GameRules:
    """Validates moves and determines game outcomes."""

    @staticmethod
    def get_valid_moves(state: GameState) -> List[Move]:
        """Get all valid moves for the current player."""
        valid_moves = []
        board = state.board
        player = state.current_player

        for row in range(board.size):
            for col in range(board.size):
                pos = Position(row, col)
                if board.get_piece(pos) == player:
                    moves = GameRules._get_piece_moves(board, pos, player)
                    valid_moves.extend(moves)

        return valid_moves

    @staticmethod
    def _get_piece_moves(board: Board, pos: Position, player: int) -> List[Move]:
        """Get all valid moves for a single piece."""
        moves = []

        # Standard moves (adjacent cells in all 8 directions)
        for direction in Direction:
            dr, dc = direction.value
            new_pos = Position(pos.row + dr, pos.col + dc)

            if new_pos.is_valid(board.size) and board.is_empty(new_pos):
                moves.append(Move(from_pos=pos, to_pos=new_pos))

        # Capture moves (jump over opponent)
        for direction in Direction:
            dr, dc = direction.value
            mid_pos = Position(pos.row + dr, pos.col + dc)
            jump_pos = Position(pos.row + 2 * dr, pos.col + 2 * dc)

            if (mid_pos.is_valid(board.size) and
                    jump_pos.is_valid(board.size) and
                    board.get_piece(mid_pos) == GameRules._opponent(player) and
                    board.is_empty(jump_pos)):
                moves.append(Move(from_pos=pos, to_pos=jump_pos, captured=mid_pos))

        return moves

    @staticmethod
    def _opponent(player: int) -> int:
        """Get the opponent of a player."""
        return PieceType.PLAYER_TWO if player == PieceType.PLAYER_ONE else PieceType.PLAYER_ONE

    @staticmethod
    def is_valid_move(state: GameState, move: Move) -> bool:
        """Check if a specific move is valid."""
        # Check if game is still in progress
        if state.phase != GamePhase.PLAYING:
            return False

        # Check if the move is from a valid piece
        board = state.board
        if not move.from_pos.is_valid(board.size):
            return False

        piece = board.get_piece(move.from_pos)
        if piece != state.current_player:
            return False

        # Check if move is in the list of valid moves
        valid_moves = GameRules.get_valid_moves(state)
        return any(
            m.from_pos == move.from_pos and
            m.to_pos == move.to_pos and
            m.captured == move.captured
            for m in valid_moves
        )

    @staticmethod
    def check_winner(state: GameState) -> Optional[int]:
        """Check if there's a winner."""
        board = state.board

        player_one_pieces = board.count_pieces(PieceType.PLAYER_ONE)
        player_two_pieces = board.count_pieces(PieceType.PLAYER_TWO)

        # Win by eliminating all opponent pieces
        if player_one_pieces == 0:
            return PieceType.PLAYER_TWO
        if player_two_pieces == 0:
            return PieceType.PLAYER_ONE

        # Win by opponent having no valid moves
        if not GameRules.get_valid_moves(state):
            return GameRules._opponent(state.current_player)

        return None

    @staticmethod
    def is_game_over(state: GameState) -> bool:
        """Check if the game has ended."""
        return GameRules.check_winner(state) is not None or state.phase == GamePhase.FINISHED

    @staticmethod
    def get_moves_for_piece(state: GameState, pos: Position) -> List[Move]:
        """Get all valid moves for a specific piece."""
        board = state.board
        piece = board.get_piece(pos)

        if piece != state.current_player:
            return []

        return GameRules._get_piece_moves(board, pos, piece)

    @staticmethod
    def has_capture_moves(state: GameState) -> bool:
        """Check if the current player has any capture moves available."""
        valid_moves = GameRules.get_valid_moves(state)
        return any(move.is_capture() for move in valid_moves)

    @staticmethod
    def get_capture_moves(state: GameState) -> List[Move]:
        """Get all capture moves for the current player."""
        valid_moves = GameRules.get_valid_moves(state)
        return [move for move in valid_moves if move.is_capture()]
