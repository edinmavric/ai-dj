"""
AI factory for creating AI instances.
"""
from typing import Dict, Type
from .base import BaseAI
from .minimax import MinimaxAI
from .alpha_beta import AlphaBetaAI
from .mcts import MCTSAI
from .astar import AStarAI
from .difficulty import DifficultyManager


class AIFactory:
    """Factory for creating AI instances."""

    ALGORITHMS: Dict[str, Type[BaseAI]] = {
        'minimax': MinimaxAI,
        'alpha_beta': AlphaBetaAI,
        'mcts': MCTSAI,
        'astar': AStarAI
    }

    @classmethod
    def create(cls, algorithm: str, **kwargs) -> BaseAI:
        """
        Create an AI instance by algorithm name.

        Args:
            algorithm: Name of the algorithm
            **kwargs: Additional arguments for the AI

        Returns:
            AI instance

        Raises:
            ValueError: If algorithm is unknown
        """
        ai_class = cls.ALGORITHMS.get(algorithm.lower())
        if not ai_class:
            raise ValueError(f"Unknown algorithm: {algorithm}")
        return ai_class(**kwargs)

    @classmethod
    def create_by_difficulty(cls, difficulty: int) -> BaseAI:
        """
        Create an AI instance based on difficulty level.

        Args:
            difficulty: Difficulty level (1-4)

        Returns:
            Configured AI instance
        """
        return DifficultyManager.get_ai(difficulty)

    @classmethod
    def list_algorithms(cls) -> list:
        """
        List all available algorithms.

        Returns:
            List of algorithm names
        """
        return list(cls.ALGORITHMS.keys())

    @classmethod
    def get_algorithm_info(cls) -> list:
        """
        Get information about all algorithms.

        Returns:
            List of algorithm info dictionaries
        """
        return [
            {
                'name': name,
                'class': ai_class.__name__,
                'description': ai_class.__doc__.strip() if ai_class.__doc__ else ''
            }
            for name, ai_class in cls.ALGORITHMS.items()
        ]
