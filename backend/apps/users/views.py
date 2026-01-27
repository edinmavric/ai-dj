"""
Views for user authentication, profiles, and leaderboards.
"""
from django.db import models
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from django.db.models import F, Window
from django.db.models.functions import RowNumber

from .models import User, RatingHistory
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    UserProfileUpdateSerializer,
    LeaderboardSerializer,
    RatingHistorySerializer,
    ChangePasswordSerializer,
)


class RegisterView(generics.CreateAPIView):
    """Register a new user account."""

    permission_classes = [AllowAny]
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserProfileSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """Login and receive JWT tokens."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserProfileSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })


class LogoutView(APIView):
    """Logout and blacklist the refresh token."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({'detail': 'Successfully logged out'})
        except Exception:
            return Response(
                {'detail': 'Invalid token'},
                status=status.HTTP_400_BAD_REQUEST
            )


class ProfileView(generics.RetrieveUpdateAPIView):
    """Get or update the current user's profile."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserProfileUpdateSerializer
        return UserProfileSerializer

    def get_object(self):
        return self.request.user


class PublicProfileView(generics.RetrieveAPIView):
    """Get a user's public profile."""

    permission_classes = [AllowAny]
    serializer_class = UserProfileSerializer
    queryset = User.objects.all()
    lookup_field = 'id'


class UserStatsView(APIView):
    """Get detailed statistics for a user."""

    permission_classes = [AllowAny]

    def get(self, request, id):
        try:
            user = User.objects.get(id=id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get PvP rating history
        pvp_bullet_history = RatingHistory.objects.filter(
            user=user, rating_type='bullet', game_mode='pvp'
        ).order_by('timestamp')[:50]
        pvp_blitz_history = RatingHistory.objects.filter(
            user=user, rating_type='blitz', game_mode='pvp'
        ).order_by('timestamp')[:50]
        pvp_rapid_history = RatingHistory.objects.filter(
            user=user, rating_type='rapid', game_mode='pvp'
        ).order_by('timestamp')[:50]

        # Get PvE rating history
        pve_bullet_history = RatingHistory.objects.filter(
            user=user, rating_type='bullet', game_mode='pve'
        ).order_by('timestamp')[:50]
        pve_blitz_history = RatingHistory.objects.filter(
            user=user, rating_type='blitz', game_mode='pve'
        ).order_by('timestamp')[:50]
        pve_rapid_history = RatingHistory.objects.filter(
            user=user, rating_type='rapid', game_mode='pve'
        ).order_by('timestamp')[:50]

        return Response({
            'user': UserProfileSerializer(user).data,
            'rating_history': {
                'pvp': {
                    'bullet': RatingHistorySerializer(pvp_bullet_history, many=True).data,
                    'blitz': RatingHistorySerializer(pvp_blitz_history, many=True).data,
                    'rapid': RatingHistorySerializer(pvp_rapid_history, many=True).data,
                },
                'pve': {
                    'bullet': RatingHistorySerializer(pve_bullet_history, many=True).data,
                    'blitz': RatingHistorySerializer(pve_blitz_history, many=True).data,
                    'rapid': RatingHistorySerializer(pve_rapid_history, many=True).data,
                }
            }
        })


class UserGamesView(generics.ListAPIView):
    """Get recent games for a user."""

    permission_classes = [AllowAny]

    def get_queryset(self):
        from apps.game.models import GameSession
        user_id = self.kwargs['id']
        return GameSession.objects.select_related(
            'player_one', 'player_two', 'current_player', 'winner'
        ).filter(
            status=GameSession.GameStatus.COMPLETED
        ).filter(
            models.Q(player_one_id=user_id) | models.Q(player_two_id=user_id)
        ).order_by('-completed_at')[:20]

    def get_serializer_class(self):
        from apps.game.serializers import GameSessionSerializer
        return GameSessionSerializer


class LeaderboardView(APIView):
    """Get leaderboard for a specific time control and game mode."""

    permission_classes = [AllowAny]

    def get(self, request, category):
        if category not in ['bullet', 'blitz', 'rapid']:
            return Response(
                {'detail': 'Invalid category. Must be bullet, blitz, or rapid'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get game mode from query params (default to pvp)
        game_mode = request.query_params.get('mode', 'pvp')
        if game_mode not in ['pvp', 'pve']:
            game_mode = 'pvp'

        # Get ordering field based on category and game mode
        if game_mode == 'pve':
            elo_field = f'elo_{category}_pve'
            games_field = f'{category}_pve_games_count'
        else:
            elo_field = f'elo_{category}'
            games_field = f'{category}_games_count'

        # Get top 100 players
        users = User.objects.filter(
            is_active=True
        ).order_by(f'-{elo_field}')[:100]

        # Add rank to each user
        result = []
        for rank, user in enumerate(users, start=1):
            data = LeaderboardSerializer(user).data
            data['rank'] = rank
            data['elo'] = getattr(user, elo_field)
            data['games_played'] = getattr(user, games_field)
            data['game_mode'] = game_mode
            result.append(data)

        return Response(result)


class LeaderboardSearchView(APIView):
    """Search for players in leaderboard."""

    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '')
        if len(query) < 2:
            return Response(
                {'detail': 'Search query must be at least 2 characters'},
                status=status.HTTP_400_BAD_REQUEST
            )

        users = User.objects.filter(
            username__icontains=query,
            is_active=True
        )[:20]

        return Response(UserProfileSerializer(users, many=True).data)


class ChangePasswordView(APIView):
    """Change the current user's password."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()

        return Response({'detail': 'Password changed successfully'})


class CustomTokenRefreshView(TokenRefreshView):
    """Custom token refresh view."""
    pass
