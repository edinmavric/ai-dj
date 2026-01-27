"""
Django models for the game application.
"""
import uuid
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class GameSession(models.Model):
    """Represents a game session."""

    class GameMode(models.TextChoices):
        PVP = 'pvp', 'Player vs Player'
        PVE = 'pve', 'Player vs AI'

    class PvPType(models.TextChoices):
        ONLINE = 'online', 'Online Ranked'    # Matchmaking, ELO counts
        LOCAL = 'local', 'Local Unranked'     # Same device, no ELO

    class GameStatus(models.TextChoices):
        WAITING = 'waiting', 'Waiting for Player'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        ABANDONED = 'abandoned', 'Abandoned'

    class Difficulty(models.IntegerChoices):
        EASY = 1, 'Easy - Demogorgon'
        MEDIUM = 2, 'Medium - Alpha AI'
        HARD = 3, 'Hard - Shadow Monster'
        NIGHTMARE = 4, 'Nightmare - Mind Flayer'

    class TimeControl(models.TextChoices):
        BULLET = 'bullet', 'Bullet'      # < 3 min
        BLITZ = 'blitz', 'Blitz'         # 3-10 min
        RAPID = 'rapid', 'Rapid'         # 10+ min
        UNLIMITED = 'unlimited', 'Unlimited'  # No time limit

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mode = models.CharField(max_length=10, choices=GameMode.choices)
    pvp_type = models.CharField(
        max_length=10,
        choices=PvPType.choices,
        null=True,
        blank=True,
        help_text='For PvP games: online (ranked) or local (unranked)'
    )
    status = models.CharField(
        max_length=20,
        choices=GameStatus.choices,
        default=GameStatus.WAITING
    )
    difficulty = models.IntegerField(
        choices=Difficulty.choices,
        null=True,
        blank=True
    )
    board_size = models.IntegerField(default=5)

    # Time Control Settings
    time_control = models.CharField(
        max_length=10,
        choices=TimeControl.choices,
        default=TimeControl.UNLIMITED
    )
    initial_time_seconds = models.IntegerField(default=0)  # Starting time per player
    increment_seconds = models.IntegerField(default=0)     # Time added per move

    # Player clocks (stored in milliseconds for precision)
    player_one_time_ms = models.IntegerField(null=True, blank=True)
    player_two_time_ms = models.IntegerField(null=True, blank=True)
    last_move_timestamp = models.DateTimeField(null=True, blank=True)
    clock_running = models.BooleanField(default=False)

    player_one = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='games_as_player_one',
        null=True,
        blank=True
    )
    player_two = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='games_as_player_two',
        null=True,
        blank=True
    )
    current_player = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='current_turn_games',
        null=True,
        blank=True
    )
    winner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='won_games',
        null=True,
        blank=True
    )

    # For PvE, track if AI won
    ai_won = models.BooleanField(default=False)

    # Game state stored as JSON
    game_state = models.JSONField(default=dict)
    move_history = models.JSONField(default=list)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Game Session'
        verbose_name_plural = 'Game Sessions'

    def __str__(self):
        return f"Game {self.id} ({self.mode}) - {self.status}"

    def is_player_turn(self, user) -> bool:
        """Check if it's the specified user's turn."""
        if self.mode == self.GameMode.PVE:
            # In PvE, it's player's turn if current_player matches
            return self.current_player == user
        else:
            return self.current_player == user

    def get_player_number(self, user) -> int:
        """Get player number (1 or 2) for a user."""
        if user == self.player_one:
            return 1
        elif user == self.player_two:
            return 2
        return 0

    def has_time_control(self) -> bool:
        """Check if game has time control enabled."""
        return self.time_control != self.TimeControl.UNLIMITED

    def should_update_elo(self) -> bool:
        """Check if this game should update ELO ratings."""
        # PvE games always update PvE ELO
        if self.mode == self.GameMode.PVE:
            return True
        # PvP games only update ELO if online (not local)
        if self.mode == self.GameMode.PVP:
            return self.pvp_type == self.PvPType.ONLINE
        return False

    def is_ranked(self) -> bool:
        """Check if this is a ranked game (ELO counts)."""
        return self.should_update_elo()

    def initialize_clocks(self):
        """Initialize player clocks based on time control."""
        if self.has_time_control():
            time_ms = self.initial_time_seconds * 1000
            self.player_one_time_ms = time_ms
            self.player_two_time_ms = time_ms

    def get_current_player_number(self) -> int:
        """Get current player number from game state."""
        if self.game_state and 'current_player' in self.game_state:
            return self.game_state['current_player']
        return 1

    def get_player_time_ms(self, player_number: int) -> int:
        """Get remaining time for a player in milliseconds."""
        if player_number == 1:
            return self.player_one_time_ms or 0
        return self.player_two_time_ms or 0

    def set_player_time_ms(self, player_number: int, time_ms: int):
        """Set remaining time for a player."""
        if player_number == 1:
            self.player_one_time_ms = max(0, time_ms)
        else:
            self.player_two_time_ms = max(0, time_ms)

    @classmethod
    def get_time_control_category(cls, initial_seconds: int) -> str:
        """Determine time control category from initial time."""
        if initial_seconds == 0:
            return cls.TimeControl.UNLIMITED
        elif initial_seconds < 180:  # < 3 min
            return cls.TimeControl.BULLET
        elif initial_seconds < 600:  # < 10 min
            return cls.TimeControl.BLITZ
        else:
            return cls.TimeControl.RAPID


# Time Control Presets
TIME_CONTROL_PRESETS = {
    'bullet': [
        {'name': '1 min', 'initial': 60, 'increment': 0},
        {'name': '1+1', 'initial': 60, 'increment': 1},
        {'name': '2+1', 'initial': 120, 'increment': 1},
    ],
    'blitz': [
        {'name': '3 min', 'initial': 180, 'increment': 0},
        {'name': '3+2', 'initial': 180, 'increment': 2},
        {'name': '5 min', 'initial': 300, 'increment': 0},
        {'name': '5+3', 'initial': 300, 'increment': 3},
    ],
    'rapid': [
        {'name': '10 min', 'initial': 600, 'increment': 0},
        {'name': '15+10', 'initial': 900, 'increment': 10},
        {'name': '30 min', 'initial': 1800, 'increment': 0},
    ],
}


class GameMove(models.Model):
    """Represents a single move in the game."""

    game = models.ForeignKey(
        GameSession,
        on_delete=models.CASCADE,
        related_name='moves'
    )
    player = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    is_ai_move = models.BooleanField(default=False)
    move_number = models.IntegerField()

    from_position = models.JSONField()  # {"row": 0, "col": 0}
    to_position = models.JSONField()    # {"row": 1, "col": 1}
    captured_position = models.JSONField(null=True, blank=True)

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['move_number']
        unique_together = ['game', 'move_number']
        verbose_name = 'Game Move'
        verbose_name_plural = 'Game Moves'

    def __str__(self):
        return f"Move {self.move_number} in {self.game_id}"
