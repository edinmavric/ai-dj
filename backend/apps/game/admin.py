"""
Django admin configuration for game models.
"""
from django.contrib import admin
from .models import GameSession, GameMove


@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    """Admin for GameSession model."""

    list_display = [
        'id', 'mode', 'status', 'difficulty', 'board_size',
        'player_one', 'player_two', 'winner', 'created_at'
    ]
    list_filter = ['mode', 'status', 'difficulty', 'created_at']
    search_fields = ['id', 'player_one__username', 'player_two__username']
    readonly_fields = ['id', 'created_at', 'updated_at', 'completed_at']
    ordering = ['-created_at']


@admin.register(GameMove)
class GameMoveAdmin(admin.ModelAdmin):
    """Admin for GameMove model."""

    list_display = [
        'id', 'game', 'player', 'is_ai_move', 'move_number', 'timestamp'
    ]
    list_filter = ['is_ai_move', 'timestamp']
    search_fields = ['game__id', 'player__username']
    ordering = ['game', 'move_number']
