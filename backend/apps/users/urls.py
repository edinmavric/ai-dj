from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    ProfileView,
    PublicProfileView,
    UserStatsView,
    UserGamesView,
    LeaderboardView,
    LeaderboardSearchView,
    ChangePasswordView,
    CustomTokenRefreshView,
)

app_name = 'users'

urlpatterns = [
    # Authentication
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('password/change/', ChangePasswordView.as_view(), name='change_password'),

    # Current user profile
    path('profile/', ProfileView.as_view(), name='profile'),

    # Public profiles
    path('<uuid:id>/', PublicProfileView.as_view(), name='public_profile'),
    path('<uuid:id>/stats/', UserStatsView.as_view(), name='user_stats'),
    path('<uuid:id>/games/', UserGamesView.as_view(), name='user_games'),

    # Leaderboards
    path('leaderboard/<str:category>/', LeaderboardView.as_view(), name='leaderboard'),
    path('leaderboard/search/', LeaderboardSearchView.as_view(), name='leaderboard_search'),
]
