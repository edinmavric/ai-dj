"""
Difficulty level management for AI.
"""
from enum import IntEnum
from typing import Dict
from .base import BaseAI
from ..engine.constants import AI_DEPTH_CONFIG, AI_CHARACTERS


class DifficultyLevel(IntEnum):
    """AI difficulty levels."""
    EASY = 1        # Demogorgon - Minimax
    MEDIUM = 2      # Alpha AI - Alpha-Beta (depth 4)
    HARD = 3        # Shadow Monster - Alpha-Beta (depth 6)
    NIGHTMARE = 4   # Mind Flayer - MCTS


class DifficultyManager:
    """Manages AI difficulty settings and algorithm selection."""

    DIFFICULTY_CONFIG: Dict[int, dict] = {
        DifficultyLevel.EASY: {
            'algorithm': 'minimax',
            'depth': AI_DEPTH_CONFIG[1]['minimax_depth'],
            'iterations': AI_DEPTH_CONFIG[1]['mcts_iterations'],
            'blunder_chance': AI_DEPTH_CONFIG[1].get('blunder_chance', 0.0),
            'character': AI_CHARACTERS[1],
            'description': 'Basic strategic play - The Demogorgon awakens'
        },
        DifficultyLevel.MEDIUM: {
            'algorithm': 'alpha_beta',
            'depth': AI_DEPTH_CONFIG[2]['minimax_depth'],
            'iterations': AI_DEPTH_CONFIG[2]['mcts_iterations'],
            'blunder_chance': AI_DEPTH_CONFIG[2].get('blunder_chance', 0.0),
            'character': AI_CHARACTERS[2],
            'description': 'Improved lookahead - Alpha predator mode'
        },
        DifficultyLevel.HARD: {
            'algorithm': 'alpha_beta',
            'depth': AI_DEPTH_CONFIG[3]['minimax_depth'],
            'iterations': AI_DEPTH_CONFIG[3]['mcts_iterations'],
            'blunder_chance': AI_DEPTH_CONFIG[3].get('blunder_chance', 0.0),
            'character': AI_CHARACTERS[3],
            'description': 'Deep analysis - Shadow Monster emerges'
        },
        DifficultyLevel.NIGHTMARE: {
            'algorithm': 'mcts',
            'depth': AI_DEPTH_CONFIG[4]['minimax_depth'],
            'iterations': AI_DEPTH_CONFIG[4]['mcts_iterations'],
            'blunder_chance': AI_DEPTH_CONFIG[4].get('blunder_chance', 0.0),
            'character': AI_CHARACTERS[4],
            'description': 'Near-optimal play - The Mind Flayer controls all'
        }
    }

    @classmethod
    def get_ai(cls, difficulty: int) -> BaseAI:
        """
        Factory method to create appropriate AI for difficulty level.

        Args:
            difficulty: Difficulty level (1-4)

        Returns:
            Configured AI instance
        """
        from .minimax import MinimaxAI
        from .alpha_beta import AlphaBetaAI
        from .mcts import MCTSAI

        config = cls.DIFFICULTY_CONFIG.get(
            difficulty,
            cls.DIFFICULTY_CONFIG[DifficultyLevel.MEDIUM]
        )

        algorithm = config['algorithm']
        blunder_chance = config.get('blunder_chance', 0.0)

        if algorithm == 'minimax':
            return MinimaxAI(depth=config['depth'], blunder_chance=blunder_chance)
        elif algorithm == 'alpha_beta':
            return AlphaBetaAI(depth=config['depth'], blunder_chance=blunder_chance)
        elif algorithm == 'mcts':
            return MCTSAI(iterations=config['iterations'], blunder_chance=blunder_chance)
        else:
            # Default fallback
            return AlphaBetaAI(depth=4, blunder_chance=blunder_chance)

    @classmethod
    def get_difficulty_info(cls, difficulty: int) -> dict:
        """
        Get information about a difficulty level.

        Args:
            difficulty: Difficulty level (1-4)

        Returns:
            Dictionary with difficulty information
        """
        config = cls.DIFFICULTY_CONFIG.get(difficulty, {})
        try:
            level = DifficultyLevel(difficulty)
            name = level.name
        except ValueError:
            name = 'UNKNOWN'

        return {
            'level': difficulty,
            'name': name,
            'character': config.get('character', 'Unknown'),
            'algorithm': config.get('algorithm', ''),
            'description': config.get('description', '')
        }

    @classmethod
    def get_all_difficulties(cls) -> list:
        """
        Get information about all difficulty levels.

        Returns:
            List of difficulty information dictionaries
        """
        return [
            cls.get_difficulty_info(level.value)
            for level in DifficultyLevel
        ]
