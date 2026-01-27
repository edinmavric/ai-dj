"""
Board representation for Stranger Things AI Game.
"""
from dataclasses import dataclass, field
from typing import List
from .constants import PieceType, MIN_BOARD_SIZE, MAX_BOARD_SIZE


@dataclass
class Position:
    """Represents a position on the board."""
    row: int
    col: int

    def to_dict(self) -> dict:
        """Convert position to dictionary."""
        return {"row": self.row, "col": self.col}

    @classmethod
    def from_dict(cls, data: dict) -> 'Position':
        """Create position from dictionary."""
        return cls(row=data['row'], col=data['col'])

    def is_valid(self, board_size: int) -> bool:
        """Check if position is within board bounds."""
        return 0 <= self.row < board_size and 0 <= self.col < board_size

    def __eq__(self, other) -> bool:
        if not isinstance(other, Position):
            return False
        return self.row == other.row and self.col == other.col

    def __hash__(self) -> int:
        return hash((self.row, self.col))


@dataclass
class Board:
    """Represents the game board."""
    size: int
    grid: List[List[int]] = field(default_factory=list)

    def __post_init__(self):
        """Validate and initialize board."""
        if not MIN_BOARD_SIZE <= self.size <= MAX_BOARD_SIZE:
            raise ValueError(
                f"Board size must be between {MIN_BOARD_SIZE} and {MAX_BOARD_SIZE}"
            )
        if not self.grid:
            self.grid = [[PieceType.EMPTY] * self.size for _ in range(self.size)]

    def get_piece(self, pos: Position) -> int:
        """Get the piece at a position."""
        if not pos.is_valid(self.size):
            raise ValueError(f"Position ({pos.row}, {pos.col}) is out of bounds for board size {self.size}")
        return self.grid[pos.row][pos.col]

    def set_piece(self, pos: Position, piece: int) -> None:
        """Set a piece at a position."""
        if not pos.is_valid(self.size):
            raise ValueError(f"Position ({pos.row}, {pos.col}) is out of bounds for board size {self.size}")
        self.grid[pos.row][pos.col] = piece

    def is_empty(self, pos: Position) -> bool:
        """Check if a position is empty."""
        return self.get_piece(pos) == PieceType.EMPTY

    def copy(self) -> 'Board':
        """Create a deep copy of the board."""
        return Board(
            size=self.size,
            grid=[row[:] for row in self.grid]
        )

    def count_pieces(self, piece_type: int) -> int:
        """Count pieces of a specific type."""
        count = 0
        for row in self.grid:
            for cell in row:
                if cell == piece_type:
                    count += 1
        return count

    def get_piece_positions(self, piece_type: int) -> List[Position]:
        """Get all positions of pieces of a specific type."""
        positions = []
        for row in range(self.size):
            for col in range(self.size):
                if self.grid[row][col] == piece_type:
                    positions.append(Position(row, col))
        return positions

    def to_dict(self) -> dict:
        """Convert board to dictionary."""
        return {
            "size": self.size,
            "grid": self.grid
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'Board':
        """Create board from dictionary."""
        return cls(size=data['size'], grid=data['grid'])

    @classmethod
    def create_initial_board(cls, size: int) -> 'Board':
        """Create a board with initial piece placement."""
        board = cls(size=size)

        # Place player one pieces on left column
        for row in range(size):
            if row != size // 2:  # Leave middle row empty
                board.set_piece(Position(row, 0), PieceType.PLAYER_ONE)

        # Place player two pieces on right column
        for row in range(size):
            if row != size // 2:  # Leave middle row empty
                board.set_piece(Position(row, size - 1), PieceType.PLAYER_TWO)

        return board
