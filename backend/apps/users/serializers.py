"""
Serializers for user authentication and profiles.
"""
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User, RatingHistory


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""

    password = serializers.CharField(
        write_only=True,
        min_length=8,
        validators=[validate_password]
    )
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password', 'password_confirm',
            'country', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'email': {'required': True},
        }

    def validate_username(self, value):
        """Validate username is alphanumeric and unique."""
        if not value.replace('_', '').isalnum():
            raise serializers.ValidationError(
                'Username can only contain letters, numbers, and underscores'
            )
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken')
        return value

    def validate_email(self, value):
        """Validate email is unique."""
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                'An account with this email already exists'
            )
        return value

    def validate(self, data):
        """Validate passwords match."""
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Passwords do not match'
            })
        return data

    def create(self, validated_data):
        """Create new user."""
        validated_data.pop('password_confirm')
        return User.objects.create_user(**validated_data)


class UserLoginSerializer(serializers.Serializer):
    """Serializer for user login."""

    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        """Validate credentials."""
        username = data.get('username')
        password = data.get('password')

        if username and password:
            user = authenticate(username=username, password=password)
            if not user:
                raise serializers.ValidationError(
                    'Invalid username or password'
                )
            if not user.is_active:
                raise serializers.ValidationError(
                    'This account has been deactivated'
                )
            data['user'] = user
        else:
            raise serializers.ValidationError(
                'Username and password are required'
            )
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile (public view)."""

    win_rate = serializers.FloatField(read_only=True)
    pve_win_rate = serializers.FloatField(read_only=True)
    highest_elo = serializers.IntegerField(read_only=True)
    highest_elo_pve = serializers.IntegerField(read_only=True)
    bullet_provisional = serializers.SerializerMethodField()
    blitz_provisional = serializers.SerializerMethodField()
    rapid_provisional = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'avatar', 'bio', 'country',
            # PvP ELO ratings
            'elo_bullet', 'elo_blitz', 'elo_rapid',
            # PvE ELO ratings
            'elo_bullet_pve', 'elo_blitz_pve', 'elo_rapid_pve',
            # Provisional flags
            'bullet_provisional', 'blitz_provisional', 'rapid_provisional',
            # PvP game counts
            'bullet_games_count', 'blitz_games_count', 'rapid_games_count',
            # PvE game counts
            'bullet_pve_games_count', 'blitz_pve_games_count', 'rapid_pve_games_count',
            # PvP statistics
            'games_played', 'games_won', 'games_lost', 'games_drawn',
            # PvE statistics
            'pve_games_played', 'pve_games_won', 'pve_games_lost',
            # Computed fields
            'win_rate', 'pve_win_rate', 'highest_elo', 'highest_elo_pve',
            'created_at'
        ]
        read_only_fields = [
            'id', 'username',
            'elo_bullet', 'elo_blitz', 'elo_rapid',
            'elo_bullet_pve', 'elo_blitz_pve', 'elo_rapid_pve',
            'bullet_games_count', 'blitz_games_count', 'rapid_games_count',
            'bullet_pve_games_count', 'blitz_pve_games_count', 'rapid_pve_games_count',
            'games_played', 'games_won', 'games_lost', 'games_drawn',
            'pve_games_played', 'pve_games_won', 'pve_games_lost',
            'created_at'
        ]

    def get_bullet_provisional(self, obj):
        return obj.is_provisional('bullet')

    def get_blitz_provisional(self, obj):
        return obj.is_provisional('blitz')

    def get_rapid_provisional(self, obj):
        return obj.is_provisional('rapid')


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile."""

    class Meta:
        model = User
        fields = ['avatar', 'bio', 'country']


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal user serializer for listings and references."""

    class Meta:
        model = User
        fields = ['id', 'username', 'avatar', 'country', 'highest_elo']
        read_only_fields = ['id', 'username', 'avatar', 'country', 'highest_elo']


class LeaderboardSerializer(serializers.ModelSerializer):
    """Serializer for leaderboard entries."""

    rank = serializers.IntegerField(read_only=True)
    win_rate = serializers.FloatField(read_only=True)

    class Meta:
        model = User
        fields = [
            'rank', 'id', 'username', 'avatar', 'country',
            'elo_bullet', 'elo_blitz', 'elo_rapid',
            'games_played', 'games_won', 'win_rate'
        ]
        read_only_fields = fields


class RatingHistorySerializer(serializers.ModelSerializer):
    """Serializer for rating history entries."""

    class Meta:
        model = RatingHistory
        fields = ['id', 'rating_type', 'game_mode', 'rating', 'change', 'game', 'timestamp']
        read_only_fields = fields


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing password."""

    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        validators=[validate_password]
    )
    new_password_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        """Validate old password is correct."""
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect')
        return value

    def validate(self, data):
        """Validate new passwords match."""
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': 'New passwords do not match'
            })
        return data
