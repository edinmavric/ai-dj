"""
WebSocket URL routing for Stranger Things AI Game.
"""
from django.urls import path
from apps.game.consumers import GameConsumer, LobbyConsumer

websocket_urlpatterns = [
    path('ws/game/<uuid:game_id>/', GameConsumer.as_asgi()),
    path('ws/lobby/', LobbyConsumer.as_asgi()),
]
