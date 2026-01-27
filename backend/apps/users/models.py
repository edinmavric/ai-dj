"""
Custom User model with ELO ratings and game statistics.
"""
import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager


class UserManager(BaseUserManager):
    """Custom user manager for User model."""

    def create_user(self, username, email=None, password=None, **extra_fields):
        if not username:
            raise ValueError('Users must have a username')
        email = self.normalize_email(email) if email else None
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(username, email, password, **extra_fields)


class User(AbstractUser):
    """Custom User model with ELO ratings and statistics."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Profile fields
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    country = models.CharField(max_length=2, blank=True)  # ISO country code

    # PvP ELO ratings per time control (for ranked online matches)
    elo_bullet = models.IntegerField(default=1200)
    elo_blitz = models.IntegerField(default=1200)
    elo_rapid = models.IntegerField(default=1200)

    # PvE ELO ratings per time control (for AI matches)
    elo_bullet_pve = models.IntegerField(default=1200)
    elo_blitz_pve = models.IntegerField(default=1200)
    elo_rapid_pve = models.IntegerField(default=1200)

    # PvP games count (for provisional calculation)
    bullet_games_count = models.IntegerField(default=0)
    blitz_games_count = models.IntegerField(default=0)
    rapid_games_count = models.IntegerField(default=0)

    # PvE games count
    bullet_pve_games_count = models.IntegerField(default=0)
    blitz_pve_games_count = models.IntegerField(default=0)
    rapid_pve_games_count = models.IntegerField(default=0)

    # Overall PvP statistics
    games_played = models.IntegerField(default=0)
    games_won = models.IntegerField(default=0)
    games_lost = models.IntegerField(default=0)
    games_drawn = models.IntegerField(default=0)

    # Overall PvE statistics
    pve_games_played = models.IntegerField(default=0)
    pve_games_won = models.IntegerField(default=0)
    pve_games_lost = models.IntegerField(default=0)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.username

    def get_elo(self, time_control: str, is_pve: bool = False) -> int:
        """Get ELO rating for a specific time control and mode."""
        if is_pve:
            elo_map = {
                'bullet': self.elo_bullet_pve,
                'blitz': self.elo_blitz_pve,
                'rapid': self.elo_rapid_pve,
                'unlimited': self.elo_blitz_pve,
            }
        else:
            elo_map = {
                'bullet': self.elo_bullet,
                'blitz': self.elo_blitz,
                'rapid': self.elo_rapid,
                'unlimited': self.elo_blitz,
            }
        return elo_map.get(time_control, 1200)

    def get_games_count(self, time_control: str, is_pve: bool = False) -> int:
        """Get games count for a specific time control and mode."""
        if is_pve:
            count_map = {
                'bullet': self.bullet_pve_games_count,
                'blitz': self.blitz_pve_games_count,
                'rapid': self.rapid_pve_games_count,
                'unlimited': self.blitz_pve_games_count,
            }
        else:
            count_map = {
                'bullet': self.bullet_games_count,
                'blitz': self.blitz_games_count,
                'rapid': self.rapid_games_count,
                'unlimited': self.blitz_games_count,
            }
        return count_map.get(time_control, 0)

    def is_provisional(self, time_control: str, is_pve: bool = False) -> bool:
        """Check if player is provisional (< 30 games in category)."""
        return self.get_games_count(time_control, is_pve) < 30

    @property
    def win_rate(self) -> float:
        """Calculate PvP win rate as percentage."""
        if self.games_played == 0:
            return 0.0
        return (self.games_won / self.games_played) * 100

    @property
    def pve_win_rate(self) -> float:
        """Calculate PvE win rate as percentage."""
        if self.pve_games_played == 0:
            return 0.0
        return (self.pve_games_won / self.pve_games_played) * 100

    @property
    def highest_elo(self) -> int:
        """Get highest PvP ELO across all time controls."""
        return max(self.elo_bullet, self.elo_blitz, self.elo_rapid)

    @property
    def highest_elo_pve(self) -> int:
        """Get highest PvE ELO across all time controls."""
        return max(self.elo_bullet_pve, self.elo_blitz_pve, self.elo_rapid_pve)


class RatingHistory(models.Model):
    """Tracks rating changes over time for rating graphs."""

    class RatingType(models.TextChoices):
        BULLET = 'bullet', 'Bullet'
        BLITZ = 'blitz', 'Blitz'
        RAPID = 'rapid', 'Rapid'

    class GameMode(models.TextChoices):
        PVP = 'pvp', 'Player vs Player'
        PVE = 'pve', 'Player vs AI'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='rating_history'
    )
    rating_type = models.CharField(max_length=10, choices=RatingType.choices)
    game_mode = models.CharField(max_length=10, choices=GameMode.choices, default=GameMode.PVP)
    rating = models.IntegerField()
    change = models.IntegerField()  # Rating change from this game
    game = models.ForeignKey(
        'game.GameSession',
        on_delete=models.SET_NULL,
        null=True,
        related_name='rating_changes'
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Rating History'
        verbose_name_plural = 'Rating Histories'

    def __str__(self):
        sign = '+' if self.change >= 0 else ''
        mode_label = 'PvE' if self.game_mode == 'pve' else 'PvP'
        return f"{self.user.username} {self.rating_type} ({mode_label}): {self.rating} ({sign}{self.change})"
