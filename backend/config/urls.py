"""
URL configuration for Stranger Things AI Game.
"""
from django.contrib import admin
from django.urls import path, include
from apps.users.views import LeaderboardView, LeaderboardSearchView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('apps.game.urls')),
    path('api/users/', include('apps.users.urls')),
    # Leaderboard endpoints at root level for cleaner API
    path('api/leaderboard/<str:category>/', LeaderboardView.as_view(), name='leaderboard'),
    path('api/leaderboard/search/', LeaderboardSearchView.as_view(), name='leaderboard_search'),
]
