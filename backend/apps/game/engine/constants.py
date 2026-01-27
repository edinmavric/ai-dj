"""
Game constants for Stranger Things AI Game.
"""
from enum import IntEnum, Enum
from typing import Final


class PieceType(IntEnum):
    """Types of pieces on the board."""
    EMPTY = 0
    PLAYER_ONE = 1   # Eleven/Heroes
    PLAYER_TWO = 2   # Demogorgon/Monsters


class Direction(Enum):
    """Movement directions."""
    UP = (-1, 0)
    DOWN = (1, 0)
    LEFT = (0, -1)
    RIGHT = (0, 1)
    UP_LEFT = (-1, -1)
    UP_RIGHT = (-1, 1)
    DOWN_LEFT = (1, -1)
    DOWN_RIGHT = (1, 1)


# Board size limits
MIN_BOARD_SIZE: Final[int] = 5
MAX_BOARD_SIZE: Final[int] = 8
DEFAULT_BOARD_SIZE: Final[int] = 5

# AI depth/iteration limits per difficulty (with blunder chance for balanced difficulty)
AI_DEPTH_CONFIG: Final[dict] = {
    1: {'minimax_depth': 2, 'mcts_iterations': 100, 'blunder_chance': 0.40},   # Easy - 40% random moves
    2: {'minimax_depth': 3, 'mcts_iterations': 300, 'blunder_chance': 0.20},   # Medium - 20% random moves
    3: {'minimax_depth': 4, 'mcts_iterations': 600, 'blunder_chance': 0.08},   # Hard - 8% random moves
    4: {'minimax_depth': 5, 'mcts_iterations': 1000, 'blunder_chance': 0.02},  # Nightmare - 2% random moves
}

# AI character names per difficulty
AI_CHARACTERS: Final[dict] = {
    1: 'Demogorgon',
    2: 'Alpha AI',
    3: 'Shadow Monster',
    4: 'Mind Flayer',
}
