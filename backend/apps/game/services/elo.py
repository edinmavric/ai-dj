"""
ELO Rating calculation service.

Implements a Chess.com-like ELO system with:
- Variable K-factors based on games played and rating
- Separate ratings for PvP and PvE
- AI opponent ratings based on difficulty
- Support for different time controls
"""
from typing import Tuple, Optional


# AI difficulty to ELO rating mapping (for PvE games)
AI_RATINGS = {
    1: 800,    # Easy - Demogorgon
    2: 1200,   # Medium - Alpha AI
    3: 1600,   # Hard - Shadow Monster
    4: 2000,   # Nightmare - Mind Flayer
}


class ELOService:
    """
    Service for calculating ELO rating changes.

    Uses Chess.com-like K-factors:
    - New players (< 30 games): K = 40 (high volatility)
    - Players < 2100 rating: K = 32
    - Players 2100-2400: K = 24
    - Players >= 2400: K = 16 (stable ratings)
    """

    # K-factor constants (Chess.com-like)
    NEW_PLAYER_K = 40      # First 30 games - high volatility
    REGULAR_K = 32         # Normal players
    INTERMEDIATE_K = 24    # 2100-2400 rated players
    MASTER_K = 16          # 2400+ rated players

    # Thresholds
    NEW_PLAYER_THRESHOLD = 30
    INTERMEDIATE_THRESHOLD = 2100
    MASTER_THRESHOLD = 2400

    # Minimum rating floor
    MIN_RATING = 100

    @staticmethod
    def calculate_expected_score(player_rating: int, opponent_rating: int) -> float:
        """
        Calculate the expected score for a player against an opponent.

        Uses the standard ELO formula:
        E = 1 / (1 + 10^((opponent_rating - player_rating) / 400))

        Args:
            player_rating: The player's current rating
            opponent_rating: The opponent's current rating

        Returns:
            Expected score between 0 and 1
        """
        exponent = (opponent_rating - player_rating) / 400.0
        return 1.0 / (1.0 + (10 ** exponent))

    @classmethod
    def get_k_factor(cls, player_games: int, player_rating: int) -> int:
        """
        Get the K-factor for a player based on their experience and rating.

        Chess.com-like K-factor system:
        - New players (< 30 games): K = 40
        - Rating < 2100: K = 32
        - Rating 2100-2400: K = 24
        - Rating >= 2400: K = 16

        Args:
            player_games: Number of rated games the player has played
            player_rating: The player's current rating

        Returns:
            K-factor to use for rating calculation
        """
        # New players get higher K for faster rating adjustment
        if player_games < cls.NEW_PLAYER_THRESHOLD:
            return cls.NEW_PLAYER_K

        # Master-level players get lowest K for stability
        if player_rating >= cls.MASTER_THRESHOLD:
            return cls.MASTER_K

        # Intermediate players
        if player_rating >= cls.INTERMEDIATE_THRESHOLD:
            return cls.INTERMEDIATE_K

        # Regular players
        return cls.REGULAR_K

    @classmethod
    def calculate_new_rating(
        cls,
        player_rating: int,
        opponent_rating: int,
        score: float,
        k_factor: int
    ) -> Tuple[int, int]:
        """
        Calculate the new rating after a game.

        Args:
            player_rating: Current rating
            opponent_rating: Opponent's rating
            score: Actual score (1.0 for win, 0.5 for draw, 0.0 for loss)
            k_factor: K-factor to use

        Returns:
            Tuple of (new_rating, rating_change)
        """
        expected = cls.calculate_expected_score(player_rating, opponent_rating)
        change = round(k_factor * (score - expected))
        new_rating = max(cls.MIN_RATING, player_rating + change)
        return new_rating, change

    @classmethod
    def process_game_result(
        cls,
        winner_rating: int,
        winner_games: int,
        loser_rating: int,
        loser_games: int,
        is_draw: bool = False
    ) -> dict:
        """
        Process a game result and calculate rating changes for both players.

        Args:
            winner_rating: Winner's current rating (or player 1 if draw)
            winner_games: Winner's total rated games played
            loser_rating: Loser's current rating (or player 2 if draw)
            loser_games: Loser's total rated games played
            is_draw: Whether the game was a draw

        Returns:
            Dictionary with rating changes for both players
        """
        if is_draw:
            winner_score = 0.5
            loser_score = 0.5
        else:
            winner_score = 1.0
            loser_score = 0.0

        winner_k = cls.get_k_factor(winner_games, winner_rating)
        loser_k = cls.get_k_factor(loser_games, loser_rating)

        winner_new, winner_change = cls.calculate_new_rating(
            winner_rating, loser_rating, winner_score, winner_k
        )
        loser_new, loser_change = cls.calculate_new_rating(
            loser_rating, winner_rating, loser_score, loser_k
        )

        return {
            'winner': {
                'old_rating': winner_rating,
                'new_rating': winner_new,
                'change': winner_change
            },
            'loser': {
                'old_rating': loser_rating,
                'new_rating': loser_new,
                'change': loser_change
            }
        }

    @classmethod
    def calculate_pve_result(
        cls,
        player_rating: int,
        player_games: int,
        ai_difficulty: int,
        player_won: bool
    ) -> dict:
        """
        Calculate rating change for a PvE game against AI.

        The AI has a fixed rating based on difficulty level.
        Player rating changes, AI rating doesn't (it's fixed).

        Args:
            player_rating: Player's current PvE rating
            player_games: Player's total PvE games played
            ai_difficulty: AI difficulty level (1-4)
            player_won: Whether the player won

        Returns:
            Dictionary with player's rating change
        """
        ai_rating = AI_RATINGS.get(ai_difficulty, 1200)
        player_k = cls.get_k_factor(player_games, player_rating)

        if player_won:
            player_score = 1.0
        else:
            player_score = 0.0

        player_new, player_change = cls.calculate_new_rating(
            player_rating, ai_rating, player_score, player_k
        )

        return {
            'player': {
                'old_rating': player_rating,
                'new_rating': player_new,
                'change': player_change
            },
            'ai_rating': ai_rating
        }


def get_rating_field_for_time_control(time_control: str, is_pve: bool = False) -> str:
    """
    Get the User model field name for a given time control.

    Args:
        time_control: Time control category ('bullet', 'blitz', 'rapid', 'unlimited')
        is_pve: Whether this is for PvE ratings

    Returns:
        Field name on User model
    """
    if is_pve:
        mapping = {
            'bullet': 'elo_bullet_pve',
            'blitz': 'elo_blitz_pve',
            'rapid': 'elo_rapid_pve',
            'unlimited': 'elo_blitz_pve',  # Default to blitz for unlimited
        }
    else:
        mapping = {
            'bullet': 'elo_bullet',
            'blitz': 'elo_blitz',
            'rapid': 'elo_rapid',
            'unlimited': 'elo_blitz',  # Default to blitz for unlimited
        }
    return mapping.get(time_control, 'elo_blitz' if not is_pve else 'elo_blitz_pve')


def get_games_count_field_for_time_control(time_control: str, is_pve: bool = False) -> str:
    """
    Get the User model games count field name for a given time control.

    Args:
        time_control: Time control category
        is_pve: Whether this is for PvE games

    Returns:
        Field name on User model
    """
    if is_pve:
        mapping = {
            'bullet': 'bullet_pve_games_count',
            'blitz': 'blitz_pve_games_count',
            'rapid': 'rapid_pve_games_count',
            'unlimited': 'blitz_pve_games_count',
        }
    else:
        mapping = {
            'bullet': 'bullet_games_count',
            'blitz': 'blitz_games_count',
            'rapid': 'rapid_games_count',
            'unlimited': 'blitz_games_count',
        }
    return mapping.get(time_control, 'blitz_games_count' if not is_pve else 'blitz_pve_games_count')


def update_ratings_for_game(game) -> Optional[dict]:
    """
    Update ELO ratings after a game completes.

    This function handles both PvP and PvE games:
    - PvP Online: Updates both players' PvP ratings
    - PvP Local: No rating changes (unranked)
    - PvE: Updates player's PvE rating against AI difficulty

    Args:
        game: GameSession instance that has completed

    Returns:
        Dictionary with rating changes, or None if ratings not updated
    """
    from apps.users.models import User, RatingHistory

    # Check if this game should update ELO
    if not game.should_update_elo():
        return None

    # Get time control for rating category
    time_control = game.time_control if game.time_control != 'unlimited' else 'blitz'
    rating_type = time_control if time_control in ['bullet', 'blitz', 'rapid'] else 'blitz'

    # Handle PvE games
    if game.mode == 'pve':
        return _update_pve_ratings(game, time_control, rating_type)

    # Handle PvP games (only online ranked)
    return _update_pvp_ratings(game, time_control, rating_type)


def _update_pve_ratings(game, time_control: str, rating_type: str) -> Optional[dict]:
    """Update ratings for a PvE game."""
    from apps.users.models import RatingHistory

    if not game.player_one:
        return None

    rating_field = get_rating_field_for_time_control(time_control, is_pve=True)
    games_count_field = get_games_count_field_for_time_control(time_control, is_pve=True)

    player = game.player_one
    player_rating = getattr(player, rating_field)
    player_games = getattr(player, games_count_field)

    # Determine if player won
    player_won = not game.ai_won

    # Calculate rating change
    result = ELOService.calculate_pve_result(
        player_rating,
        player_games,
        game.difficulty or 1,
        player_won
    )

    player_change = result['player']

    # Update player
    setattr(player, rating_field, player_change['new_rating'])
    setattr(player, games_count_field, player_games + 1)
    player.pve_games_played += 1
    if player_won:
        player.pve_games_won += 1
    else:
        player.pve_games_lost += 1
    player.save()

    # Create rating history record
    RatingHistory.objects.create(
        user=player,
        rating_type=rating_type,
        game_mode='pve',
        rating=player_change['new_rating'],
        change=player_change['change'],
        game=game
    )

    return {
        'player_one': {
            'user_id': str(player.id),
            'old_rating': player_change['old_rating'],
            'new_rating': player_change['new_rating'],
            'change': player_change['change']
        },
        'ai_rating': result['ai_rating']
    }


def _update_pvp_ratings(game, time_control: str, rating_type: str) -> Optional[dict]:
    """Update ratings for a PvP game."""
    from apps.users.models import RatingHistory

    # Need both players
    if not game.player_one or not game.player_two:
        return None

    rating_field = get_rating_field_for_time_control(time_control, is_pve=False)
    games_count_field = get_games_count_field_for_time_control(time_control, is_pve=False)

    # Get current ratings
    p1 = game.player_one
    p2 = game.player_two

    p1_rating = getattr(p1, rating_field)
    p2_rating = getattr(p2, rating_field)
    p1_games = getattr(p1, games_count_field)
    p2_games = getattr(p2, games_count_field)

    # Determine winner/loser
    is_draw = game.winner is None and not game.ai_won

    if is_draw:
        # Draw - both get partial points
        result = ELOService.process_game_result(
            p1_rating, p1_games, p2_rating, p2_games, is_draw=True
        )
        p1_change = result['winner']
        p2_change = result['loser']
    elif game.winner == p1:
        result = ELOService.process_game_result(
            p1_rating, p1_games, p2_rating, p2_games, is_draw=False
        )
        p1_change = result['winner']
        p2_change = result['loser']
    else:
        result = ELOService.process_game_result(
            p2_rating, p2_games, p1_rating, p1_games, is_draw=False
        )
        p1_change = result['loser']
        p2_change = result['winner']

    # Update player 1
    setattr(p1, rating_field, p1_change['new_rating'])
    setattr(p1, games_count_field, p1_games + 1)
    p1.games_played += 1
    if game.winner == p1:
        p1.games_won += 1
    elif game.winner == p2:
        p1.games_lost += 1
    else:
        p1.games_drawn += 1
    p1.save()

    # Update player 2
    setattr(p2, rating_field, p2_change['new_rating'])
    setattr(p2, games_count_field, p2_games + 1)
    p2.games_played += 1
    if game.winner == p2:
        p2.games_won += 1
    elif game.winner == p1:
        p2.games_lost += 1
    else:
        p2.games_drawn += 1
    p2.save()

    # Create rating history records
    RatingHistory.objects.create(
        user=p1,
        rating_type=rating_type,
        game_mode='pvp',
        rating=p1_change['new_rating'],
        change=p1_change['change'],
        game=game
    )

    RatingHistory.objects.create(
        user=p2,
        rating_type=rating_type,
        game_mode='pvp',
        rating=p2_change['new_rating'],
        change=p2_change['change'],
        game=game
    )

    return {
        'player_one': {
            'user_id': str(p1.id),
            'old_rating': p1_change['old_rating'],
            'new_rating': p1_change['new_rating'],
            'change': p1_change['change']
        },
        'player_two': {
            'user_id': str(p2.id),
            'old_rating': p2_change['old_rating'],
            'new_rating': p2_change['new_rating'],
            'change': p2_change['change']
        }
    }
