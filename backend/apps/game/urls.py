from django.urls import path
from . import views

app_name = 'game'

urlpatterns = [
    # Game Session Management
    path('games/', views.GameListCreateView.as_view(), name='game-list-create'),
    path('games/<uuid:pk>/', views.GameDetailView.as_view(), name='game-detail'),
    path('games/<uuid:pk>/join/', views.JoinGameView.as_view(), name='game-join'),
    path('games/<uuid:pk>/move/', views.MakeMoveView.as_view(), name='game-move'),
    path('games/<uuid:pk>/forfeit/', views.ForfeitGameView.as_view(), name='game-forfeit'),
    path('games/<uuid:pk>/state/', views.GameStateView.as_view(), name='game-state'),

    # Lobby
    path('lobby/', views.LobbyView.as_view(), name='lobby'),

    # Difficulty levels info
    path('difficulty-levels/', views.DifficultyLevelsView.as_view(), name='difficulty-levels'),

    # Time control presets
    path('time-controls/', views.TimeControlPresetsView.as_view(), name='time-controls'),
]
