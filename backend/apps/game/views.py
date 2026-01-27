"""
API views for the game application.
"""
from django.db import models
from django.utils import timezone
from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import GameSession, GameMove, TIME_CONTROL_PRESETS
from .serializers import (
    GameSessionSerializer,
    CreateGameSerializer,
    MakeMoveSerializer,
    DifficultyLevelSerializer,
    LobbyGameSerializer,
    TimeControlPresetsSerializer
)
from .engine import GameState, Move, Position, GameRules, GamePhase, PieceType
from .ai import AIFactory, DifficultyManager


class GameListCreateView(generics.ListCreateAPIView):
    """List user's games or create a new game."""

    serializer_class = GameSessionSerializer
    permission_classes = [AllowAny]  # Allow anonymous play for now

    def get_queryset(self):
        """Get games for the current user."""
        if self.request.user.is_authenticated:
            return GameSession.objects.select_related(
                'player_one', 'player_two', 'current_player', 'winner'
            ).filter(
                models.Q(player_one=self.request.user) |
                models.Q(player_two=self.request.user)
            )
        return GameSession.objects.none()

    def create(self, request, *args, **kwargs):
        """Create a new game."""
        serializer = CreateGameSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Guests can only play vs AI
        if data['mode'] == GameSession.GameMode.PVP and not request.user.is_authenticated:
            return Response(
                {'error': 'Login required for Player vs Player games. Guests can only play vs AI.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Create initial game state
        board_size = data.get('board_size', 5)
        initial_state = GameState.create_initial_state(board_size)

        # Get time control settings
        time_control = data.get('time_control', GameSession.TimeControl.UNLIMITED)
        initial_time_seconds = data.get('initial_time_seconds', 0)
        increment_seconds = data.get('increment_seconds', 0)

        # Determine initial status based on mode and pvp_type
        if data['mode'] == GameSession.GameMode.PVE:
            initial_status = GameSession.GameStatus.IN_PROGRESS
        elif data.get('pvp_type') == GameSession.PvPType.LOCAL:
            # Local PvP starts immediately (same device)
            initial_status = GameSession.GameStatus.IN_PROGRESS
        else:
            # Online PvP waits for opponent
            initial_status = GameSession.GameStatus.WAITING

        # Create game session
        game = GameSession.objects.create(
            mode=data['mode'],
            pvp_type=data.get('pvp_type'),
            difficulty=data.get('difficulty'),
            board_size=board_size,
            player_one=request.user if request.user.is_authenticated else None,
            game_state=initial_state.to_dict(),
            status=initial_status,
            # Time control
            time_control=time_control,
            initial_time_seconds=initial_time_seconds,
            increment_seconds=increment_seconds,
        )

        # Initialize clocks if timed game
        if game.has_time_control():
            game.initialize_clocks()

        # Set current player
        if request.user.is_authenticated:
            game.current_player = request.user
            game.save()

        response_serializer = GameSessionSerializer(game)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class GameDetailView(generics.RetrieveAPIView):
    """Get game details."""

    queryset = GameSession.objects.select_related(
        'player_one', 'player_two', 'current_player', 'winner'
    ).all()
    serializer_class = GameSessionSerializer
    permission_classes = [AllowAny]


class JoinGameView(views.APIView):
    """Join an existing game."""

    permission_classes = [AllowAny]

    def post(self, request, pk):
        """Join a game as player two."""
        try:
            game = GameSession.objects.get(pk=pk)
        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if game.status != GameSession.GameStatus.WAITING:
            return Response(
                {'error': 'Game is not waiting for players'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if game.mode != GameSession.GameMode.PVP:
            return Response(
                {'error': 'Cannot join a single-player game'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Guests cannot join PvP games
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Login required to join Player vs Player games'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if request.user.is_authenticated:
            if game.player_one == request.user:
                return Response(
                    {'error': 'Cannot join your own game'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            game.player_two = request.user

        game.status = GameSession.GameStatus.IN_PROGRESS
        game.save()

        serializer = GameSessionSerializer(game)
        return Response(serializer.data)


class MakeMoveView(views.APIView):
    """Make a move in the game (REST fallback for WebSocket)."""

    permission_classes = [AllowAny]

    def post(self, request, pk):
        """Make a move."""
        try:
            game = GameSession.objects.get(pk=pk)
        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if game.status != GameSession.GameStatus.IN_PROGRESS:
            return Response(
                {'error': 'Game is not in progress'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = MakeMoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Load game state
        state = GameState.from_dict(game.game_state)

        # Create move
        move = Move(
            from_pos=Position(**data['from_position']),
            to_pos=Position(**data['to_position']),
            captured=Position(**data['captured_position']) if data.get('captured_position') else None
        )

        # Validate move
        if not GameRules.is_valid_move(state, move):
            return Response(
                {'error': 'Invalid move'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Apply move
        new_state = state.apply_move(move)

        # Record move
        GameMove.objects.create(
            game=game,
            player=request.user if request.user.is_authenticated else None,
            move_number=len(game.move_history) + 1,
            from_position=data['from_position'],
            to_position=data['to_position'],
            captured_position=data.get('captured_position')
        )

        # Check for winner
        winner = GameRules.check_winner(new_state)
        if winner:
            new_state.winner = winner
            new_state.phase = GamePhase.FINISHED
            game.status = GameSession.GameStatus.COMPLETED
            game.completed_at = timezone.now()
            if winner == PieceType.PLAYER_ONE:
                game.winner = game.player_one
            elif winner == PieceType.PLAYER_TWO:
                if game.mode == GameSession.GameMode.PVE:
                    game.ai_won = True
                else:
                    game.winner = game.player_two

        # Update game state
        game.game_state = new_state.to_dict()
        game.move_history.append(move.to_dict())
        game.save()

        response_data = {
            'success': True,
            'game_state': new_state.to_dict()
        }

        # If PvE and it's AI's turn, make AI move
        if (game.mode == GameSession.GameMode.PVE and
                not GameRules.is_game_over(new_state) and
                new_state.current_player == PieceType.PLAYER_TWO):
            ai_result = self._make_ai_move(game, new_state)
            response_data['ai_move'] = ai_result

        return Response(response_data)

    def _make_ai_move(self, game, state):
        """Make an AI move."""
        ai = AIFactory.create_by_difficulty(game.difficulty)
        ai_move = ai.get_best_move(state)

        if not ai_move:
            return None

        # Apply AI move
        new_state = state.apply_move(ai_move)

        # Record AI move
        GameMove.objects.create(
            game=game,
            is_ai_move=True,
            move_number=len(game.move_history) + 1,
            from_position=ai_move.from_pos.to_dict(),
            to_position=ai_move.to_pos.to_dict(),
            captured_position=ai_move.captured.to_dict() if ai_move.captured else None
        )

        # Check for winner
        winner = GameRules.check_winner(new_state)
        if winner:
            new_state.winner = winner
            new_state.phase = GamePhase.FINISHED
            game.status = GameSession.GameStatus.COMPLETED
            game.completed_at = timezone.now()
            if winner == PieceType.PLAYER_TWO:
                game.ai_won = True
            else:
                game.winner = game.player_one

        # Update game state
        game.game_state = new_state.to_dict()
        game.move_history.append(ai_move.to_dict())
        game.save()

        return {
            'move': ai_move.to_dict(),
            'game_state': new_state.to_dict(),
            'stats': ai.get_stats()
        }


class ForfeitGameView(views.APIView):
    """Forfeit a game."""

    permission_classes = [AllowAny]

    def post(self, request, pk):
        """Forfeit the game."""
        try:
            game = GameSession.objects.get(pk=pk)
        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if game.status != GameSession.GameStatus.IN_PROGRESS:
            return Response(
                {'error': 'Game is not in progress'},
                status=status.HTTP_400_BAD_REQUEST
            )

        game.status = GameSession.GameStatus.COMPLETED
        game.completed_at = timezone.now()

        # Set winner as the other player
        if game.mode == GameSession.GameMode.PVE:
            game.ai_won = True
        elif request.user.is_authenticated:
            if request.user == game.player_one:
                game.winner = game.player_two
            else:
                game.winner = game.player_one

        game.save()

        return Response({
            'success': True,
            'winner': str(game.winner.id) if game.winner else None,
            'ai_won': game.ai_won
        })


class GameStateView(views.APIView):
    """Get current game state."""

    permission_classes = [AllowAny]

    def get(self, request, pk):
        """Get game state."""
        try:
            game = GameSession.objects.get(pk=pk)
        except GameSession.DoesNotExist:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response({
            'game_state': game.game_state,
            'status': game.status,
            'mode': game.mode,
            'difficulty': game.difficulty
        })


class LobbyView(generics.ListAPIView):
    """List available games in the lobby."""

    serializer_class = LobbyGameSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        """Get waiting PvP games."""
        return GameSession.objects.select_related('player_one').filter(
            mode=GameSession.GameMode.PVP,
            status=GameSession.GameStatus.WAITING
        )


class DifficultyLevelsView(views.APIView):
    """Get available difficulty levels."""

    permission_classes = [AllowAny]

    def get(self, request):
        """Get all difficulty levels."""
        difficulties = DifficultyManager.get_all_difficulties()
        serializer = DifficultyLevelSerializer(difficulties, many=True)
        return Response(serializer.data)


class TimeControlPresetsView(views.APIView):
    """Get available time control presets."""

    permission_classes = [AllowAny]

    def get(self, request):
        """Get all time control presets grouped by category."""
        return Response(TIME_CONTROL_PRESETS)
