"""
Game state management for Stranger Things AI Game.
"""
from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum
from .board import Board, Position
from .move import Move
from .constants import PieceType


class GamePhase(Enum):
    """Game phases."""
    SETUP = "setup"
    PLAYING = "playing"
    FINISHED = "finished"


@dataclass
class GameState:
    """Complete game state representation."""
    board: Board
    current_player: int  # PieceType.PLAYER_ONE or PLAYER_TWO
    phase: GamePhase = GamePhase.PLAYING
    move_history: List[Move] = field(default_factory=list)
    winner: Optional[int] = None

    @property
    def turn_number(self) -> int:
        """Get current turn number."""
        return len(self.move_history) + 1

    def apply_move(self, move: Move) -> 'GameState':
        """Apply a move and return new game state (immutable)."""
        new_board = self.board.copy()

        # Move the piece
        piece = new_board.get_piece(move.from_pos)
        new_board.set_piece(move.from_pos, PieceType.EMPTY)
        new_board.set_piece(move.to_pos, piece)

        # Handle capture
        if move.captured:
            new_board.set_piece(move.captured, PieceType.EMPTY)

        # Switch player
        next_player = (
            PieceType.PLAYER_TWO if self.current_player == PieceType.PLAYER_ONE
            else PieceType.PLAYER_ONE
        )

        return GameState(
            board=new_board,
            current_player=next_player,
            phase=self.phase,
            move_history=self.move_history + [move],
            winner=self.winner
        )

    def get_opponent(self, player: int) -> int:
        """Get the opponent of a player."""
        return PieceType.PLAYER_TWO if player == PieceType.PLAYER_ONE else PieceType.PLAYER_ONE

    def copy(self) -> 'GameState':
        """Create a deep copy of the game state."""
        return GameState(
            board=self.board.copy(),
            current_player=self.current_player,
            phase=self.phase,
            move_history=self.move_history.copy(),
            winner=self.winner
        )

    def to_dict(self) -> dict:
        """Convert game state to dictionary."""
        return {
            "board": self.board.to_dict(),
            "current_player": self.current_player,
            "phase": self.phase.value,
            "move_history": [m.to_dict() for m in self.move_history],
            "winner": self.winner,
            "turn_number": self.turn_number
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'GameState':
        """Create game state from dictionary."""
        return cls(
            board=Board.from_dict(data['board']),
            current_player=data['current_player'],
            phase=GamePhase(data['phase']),
            move_history=[Move.from_dict(m) for m in data.get('move_history', [])],
            winner=data.get('winner')
        )

    @classmethod
    def create_initial_state(cls, board_size: int = 5) -> 'GameState':
        """Create an initial game state."""
        return cls(
            board=Board.create_initial_board(board_size),
            current_player=PieceType.PLAYER_ONE,
            phase=GamePhase.PLAYING
        )
