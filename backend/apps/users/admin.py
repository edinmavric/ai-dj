"""
Admin configuration for User models.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, RatingHistory


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin view for User model."""

    list_display = [
        'username', 'email', 'elo_bullet', 'elo_blitz', 'elo_rapid',
        'games_played', 'games_won', 'is_active', 'created_at'
    ]
    list_filter = ['is_active', 'is_staff', 'country']
    search_fields = ['username', 'email']
    ordering = ['-created_at']

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal Info', {'fields': ('email', 'avatar', 'bio', 'country')}),
        ('ELO Ratings', {'fields': (
            'elo_bullet', 'elo_blitz', 'elo_rapid',
            'bullet_games_count', 'blitz_games_count', 'rapid_games_count'
        )}),
        ('Statistics', {'fields': (
            'games_played', 'games_won', 'games_lost', 'games_drawn'
        )}),
        ('Permissions', {'fields': (
            'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'
        )}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2'),
        }),
    )


@admin.register(RatingHistory)
class RatingHistoryAdmin(admin.ModelAdmin):
    """Admin view for RatingHistory model."""

    list_display = ['user', 'rating_type', 'rating', 'change', 'timestamp']
    list_filter = ['rating_type', 'timestamp']
    search_fields = ['user__username']
    ordering = ['-timestamp']
    readonly_fields = ['timestamp']
