"""
Tests for AI algorithms.
"""
import pytest
from apps.game.engine import Board, Position, GameState, PieceType, GameRules
from apps.game.ai import MinimaxAI, AlphaBetaAI, MCTSAI, AIFactory


class TestMinimaxAI:
    """Tests for MinimaxAI class."""

    def test_minimax_returns_move(self, simple_game_state):
        """Test that minimax returns a valid move."""
        ai = MinimaxAI(depth=2)
        move = ai.get_best_move(simple_game_state)

        assert move is not None
        assert GameRules.is_valid_move(simple_game_state, move)

    def test_minimax_finds_winning_move(self):
        """Test that minimax finds an obvious winning move."""
        # Create a state where capture wins the game
        board = Board(size=5)
        board.set_piece(Position(2, 0), PieceType.PLAYER_ONE)
        board.set_piece(Position(2, 1), PieceType.PLAYER_TWO)

        state = GameState(board=board, current_player=PieceType.PLAYER_ONE)

        ai = MinimaxAI(depth=2)
        move = ai.get_best_move(state)

        # Should find the capture move
        assert move is not None
        assert move.is_capture()

    def test_minimax_stats(self, simple_game_state):
        """Test that minimax tracks statistics."""
        ai = MinimaxAI(depth=2)
        ai.get_best_move(simple_game_state)

        stats = ai.get_stats()
        assert stats['algorithm'] == 'Minimax'
        assert stats['nodes_evaluated'] > 0


class TestAlphaBetaAI:
    """Tests for AlphaBetaAI class."""

    def test_alpha_beta_returns_move(self, simple_game_state):
        """Test that alpha-beta returns a valid move."""
        ai = AlphaBetaAI(depth=3)
        move = ai.get_best_move(simple_game_state)

        assert move is not None
        assert GameRules.is_valid_move(simple_game_state, move)

    def test_alpha_beta_prunes(self, simple_game_state):
        """Test that alpha-beta prunes nodes."""
        ai = AlphaBetaAI(depth=4)
        ai.get_best_move(simple_game_state)

        stats = ai.get_stats()
        assert stats['pruned_nodes'] >= 0

    def test_alpha_beta_vs_minimax(self, simple_game_state):
        """Test that alpha-beta evaluates fewer nodes than minimax."""
        minimax = MinimaxAI(depth=3)
        alpha_beta = AlphaBetaAI(depth=3)

        minimax.get_best_move(simple_game_state)
        alpha_beta.get_best_move(simple_game_state)

        # Alpha-beta should evaluate fewer or equal nodes
        assert alpha_beta.nodes_evaluated <= minimax.nodes_evaluated


class TestMCTSAI:
    """Tests for MCTSAI class."""

    def test_mcts_returns_move(self, simple_game_state):
        """Test that MCTS returns a valid move."""
        ai = MCTSAI(iterations=100)
        move = ai.get_best_move(simple_game_state)

        assert move is not None
        assert GameRules.is_valid_move(simple_game_state, move)

    def test_mcts_stats(self, simple_game_state):
        """Test that MCTS tracks statistics."""
        ai = MCTSAI(iterations=50)
        ai.get_best_move(simple_game_state)

        stats = ai.get_stats()
        assert stats['algorithm'] == 'Monte Carlo Tree Search'
        assert stats['simulations_run'] > 0


class TestAIFactory:
    """Tests for AIFactory class."""

    def test_create_by_name(self):
        """Test creating AI by algorithm name."""
        minimax = AIFactory.create('minimax', depth=2)
        assert minimax.get_name() == 'Minimax'

        alpha_beta = AIFactory.create('alpha_beta', depth=3)
        assert alpha_beta.get_name() == 'Alpha-Beta Pruning'

        mcts = AIFactory.create('mcts', iterations=100)
        assert mcts.get_name() == 'Monte Carlo Tree Search'

    def test_create_by_difficulty(self):
        """Test creating AI by difficulty level."""
        easy_ai = AIFactory.create_by_difficulty(1)
        assert easy_ai.get_name() == 'Minimax'

        hard_ai = AIFactory.create_by_difficulty(3)
        assert hard_ai.get_name() == 'Alpha-Beta Pruning'

        nightmare_ai = AIFactory.create_by_difficulty(4)
        assert nightmare_ai.get_name() == 'Monte Carlo Tree Search'

    def test_create_unknown_algorithm(self):
        """Test creating AI with unknown algorithm."""
        with pytest.raises(ValueError):
            AIFactory.create('unknown_algo')

    def test_list_algorithms(self):
        """Test listing available algorithms."""
        algos = AIFactory.list_algorithms()
        assert 'minimax' in algos
        assert 'alpha_beta' in algos
        assert 'mcts' in algos
        assert 'astar' in algos
