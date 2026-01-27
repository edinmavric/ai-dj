"""
Serializers for the game API.
"""
from rest_framework import serializers
from .models import GameSession, GameMove, TIME_CONTROL_PRESETS
from .ai.difficulty import DifficultyManager


class GameMoveSerializer(serializers.ModelSerializer):
    """Serializer for game moves."""

    class Meta:
        model = GameMove
        fields = [
            'id', 'move_number', 'from_position', 'to_position',
            'captured_position', 'is_ai_move', 'timestamp'
        ]
        read_only_fields = ['id', 'move_number', 'timestamp']


class GameSessionSerializer(serializers.ModelSerializer):
    """Serializer for game sessions."""

    player_one_username = serializers.CharField(
        source='player_one.username',
        read_only=True,
        allow_null=True
    )
    player_two_username = serializers.CharField(
        source='player_two.username',
        read_only=True,
        allow_null=True
    )
    current_player_username = serializers.CharField(
        source='current_player.username',
        read_only=True,
        allow_null=True
    )
    winner_username = serializers.CharField(
        source='winner.username',
        read_only=True,
        allow_null=True
    )
    difficulty_info = serializers.SerializerMethodField()
    time_control_display = serializers.SerializerMethodField()

    class Meta:
        model = GameSession
        fields = [
            'id', 'mode', 'pvp_type', 'status', 'difficulty', 'difficulty_info',
            'board_size', 'player_one', 'player_one_username',
            'player_two', 'player_two_username', 'current_player',
            'current_player_username', 'winner', 'winner_username',
            'ai_won', 'game_state', 'created_at', 'updated_at', 'completed_at',
            # Time control fields
            'time_control', 'time_control_display', 'initial_time_seconds',
            'increment_seconds', 'player_one_time_ms', 'player_two_time_ms',
            'clock_running'
        ]
        read_only_fields = [
            'id', 'status', 'current_player', 'winner', 'ai_won',
            'game_state', 'created_at', 'updated_at', 'completed_at',
            'player_one_time_ms', 'player_two_time_ms', 'clock_running'
        ]

    def get_difficulty_info(self, obj):
        """Get difficulty level information."""
        if obj.difficulty:
            return DifficultyManager.get_difficulty_info(obj.difficulty)
        return None

    def get_time_control_display(self, obj):
        """Get human-readable time control string."""
        if obj.time_control == GameSession.TimeControl.UNLIMITED:
            return 'Unlimited'
        minutes = obj.initial_time_seconds // 60
        if obj.increment_seconds > 0:
            return f"{minutes}+{obj.increment_seconds}"
        return f"{minutes} min"


class CreateGameSerializer(serializers.Serializer):
    """Serializer for creating a new game."""

    mode = serializers.ChoiceField(choices=GameSession.GameMode.choices)
    pvp_type = serializers.ChoiceField(
        choices=GameSession.PvPType.choices,
        required=False,
        allow_null=True
    )
    difficulty = serializers.IntegerField(required=False, allow_null=True)
    board_size = serializers.IntegerField(min_value=5, max_value=8, default=5)
    # Time control fields
    time_control = serializers.ChoiceField(
        choices=GameSession.TimeControl.choices,
        default=GameSession.TimeControl.UNLIMITED
    )
    initial_time_seconds = serializers.IntegerField(min_value=0, default=0)
    increment_seconds = serializers.IntegerField(min_value=0, default=0)

    def validate(self, data):
        """Validate game creation data."""
        if data['mode'] == GameSession.GameMode.PVE and not data.get('difficulty'):
            raise serializers.ValidationError({
                'difficulty': 'Difficulty is required for PvE mode'
            })
        if data.get('difficulty') and data['difficulty'] not in [1, 2, 3, 4]:
            raise serializers.ValidationError({
                'difficulty': 'Difficulty must be between 1 and 4'
            })
        # Handle legacy 'online' value (convert to 'online_ranked')
        if data.get('pvp_type') == 'online':
            data['pvp_type'] = GameSession.PvPType.ONLINE_RANKED
        # For PvP mode, default to local if not specified
        if data['mode'] == GameSession.GameMode.PVP and not data.get('pvp_type'):
            data['pvp_type'] = GameSession.PvPType.LOCAL
        # Determine time control category if not unlimited
        if data['initial_time_seconds'] > 0:
            data['time_control'] = GameSession.get_time_control_category(
                data['initial_time_seconds']
            )
        return data


class TimeControlPresetSerializer(serializers.Serializer):
    """Serializer for time control presets."""
    name = serializers.CharField()
    initial = serializers.IntegerField()
    increment = serializers.IntegerField()


class TimeControlPresetsSerializer(serializers.Serializer):
    """Serializer for all time control presets."""
    bullet = TimeControlPresetSerializer(many=True)
    blitz = TimeControlPresetSerializer(many=True)
    rapid = TimeControlPresetSerializer(many=True)


class MakeMoveSerializer(serializers.Serializer):
    """Serializer for making a move."""

    from_position = serializers.DictField(child=serializers.IntegerField())
    to_position = serializers.DictField(child=serializers.IntegerField())
    captured_position = serializers.DictField(
        child=serializers.IntegerField(),
        required=False,
        allow_null=True
    )

    def validate_from_position(self, value):
        """Validate from position format."""
        if 'row' not in value or 'col' not in value:
            raise serializers.ValidationError(
                'Position must have row and col fields'
            )
        return value

    def validate_to_position(self, value):
        """Validate to position format."""
        if 'row' not in value or 'col' not in value:
            raise serializers.ValidationError(
                'Position must have row and col fields'
            )
        return value


class DifficultyLevelSerializer(serializers.Serializer):
    """Serializer for difficulty level information."""

    level = serializers.IntegerField()
    name = serializers.CharField()
    character = serializers.CharField()
    algorithm = serializers.CharField()
    description = serializers.CharField()


class LobbyGameSerializer(serializers.ModelSerializer):
    """Serializer for games in the lobby."""

    host_username = serializers.CharField(
        source='player_one.username',
        read_only=True,
        allow_null=True
    )
    time_control_display = serializers.SerializerMethodField()

    class Meta:
        model = GameSession
        fields = [
            'id', 'host_username', 'board_size', 'time_control',
            'time_control_display', 'initial_time_seconds', 'increment_seconds',
            'created_at'
        ]

    def get_time_control_display(self, obj):
        """Get human-readable time control string."""
        if obj.time_control == GameSession.TimeControl.UNLIMITED:
            return 'Unlimited'
        minutes = obj.initial_time_seconds // 60
        if obj.increment_seconds > 0:
            return f"{minutes}+{obj.increment_seconds}"
        return f"{minutes} min"
