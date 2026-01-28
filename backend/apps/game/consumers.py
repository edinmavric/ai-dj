"""
WebSocket consumers for real-time game communication.
"""
import json
import asyncio
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.db import transaction
from django.utils import timezone
from datetime import datetime

from .models import GameSession, GameMove
from .engine import GameState, Move, Position, GameRules, GamePhase, PieceType
from .ai import AIFactory
from .services.elo import update_ratings_for_game


class GameConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for game communication."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.clock_task = None
        self.game_id = None
        self.room_group_name = None

    async def connect(self):
        """Handle WebSocket connection."""
        self.game_id = self.scope['url_route']['kwargs']['game_id']
        self.room_group_name = f'game_{self.game_id}'
        self.user = self.scope.get('user')

        # Join game room
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Send initial game state
        game_state = await self.get_game_state()
        if game_state:
            await self.send_json({
                'type': 'game_state',
                'data': game_state
            })

            # Start clock if it should be running
            # This handles reconnections where game is in progress
            if game_state.get('clock_running'):
                await self.start_clock()
        else:
            await self.send_json({
                'type': 'error',
                'data': {'message': 'Game not found'}
            })

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Cancel clock task if running
        if self.clock_task:
            self.clock_task.cancel()
            self.clock_task = None

        # Leave game room
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        # Notify other players
        user_id = str(self.user.id) if self.user and self.user.is_authenticated else None
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'player_disconnected',
                'player_id': user_id
            }
        )

    async def receive_json(self, content: Dict[str, Any]):
        """Handle incoming WebSocket messages."""
        message_type = content.get('type')
        data = content.get('data', {})

        handlers = {
            'make_move': self.handle_make_move,
            'request_state': self.handle_request_state,
            'forfeit': self.handle_forfeit,
            'request_rematch': self.handle_request_rematch,
            'accept_rematch': self.handle_accept_rematch,
            'decline_rematch': self.handle_decline_rematch,
            'chat_message': self.handle_chat_message,
        }

        handler = handlers.get(message_type)
        if handler:
            await handler(data)
        else:
            await self.send_json({
                'type': 'error',
                'data': {'message': f'Unknown message type: {message_type}'}
            })

    async def handle_make_move(self, data: Dict[str, Any]):
        """Handle a player's move."""
        # Validate move data
        try:
            move = Move(
                from_pos=Position(**data['from']),
                to_pos=Position(**data['to']),
                captured=Position(**data['captured']) if data.get('captured') else None
            )
        except (KeyError, TypeError, ValueError):
            await self.send_json({
                'type': 'error',
                'data': {'message': 'Invalid move format'}
            })
            return

        # Stop current clock tick
        await self.stop_clock()

        # Process move on backend
        result = await self.process_move(move)

        if result['success']:
            # Broadcast updated state to all players
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_update',
                    'data': {
                        'game_state': result['game_state'],
                        'ai_turn': result.get('ai_turn', False),
                        'player_one_time_ms': result.get('player_one_time_ms'),
                        'player_two_time_ms': result.get('player_two_time_ms'),
                        'clock_running': result.get('clock_running', False),
                        'rating_changes': result.get('rating_changes')
                    }
                }
            )

            # Check if game ended from player's move
            if result.get('game_over'):
                # Determine the reason for game over
                reason = 'capture' if result.get('captured_all') else 'no_moves'
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'game_over',
                        'data': {
                            'winner': result.get('winner'),
                            'winner_id': result.get('winner_id'),
                            'ai_won': result.get('ai_won', False),
                            'reason': reason,
                            'rating_changes': result.get('rating_changes')
                        }
                    }
                )
                return  # Game ended, don't continue

            # Start clock for next player if game continues
            if result.get('clock_running'):
                await self.start_clock()

            # Check if AI should move
            if result.get('ai_turn'):
                await self.trigger_ai_move()
        else:
            # Restart clock on rejected move
            clock_running = await self.is_clock_running()
            if clock_running:
                await self.start_clock()

            await self.send_json({
                'type': 'move_rejected',
                'data': {'message': result['message']}
            })

    async def trigger_ai_move(self):
        """Trigger AI to make a move."""
        try:
            await asyncio.sleep(0.5)  # Small delay for UX

            # Don't stop clock - AI time should run while calculating
            # The clock will automatically detect timeout if AI runs out of time

            ai_result = await self.calculate_ai_move()

            # Check if AI timed out during calculation
            if not ai_result['success']:
                if ai_result.get('timed_out'):
                    logger.info(f"AI timed out in game {self.game_id}")
                    await self.handle_timeout(2)  # AI (player 2) timed out
                else:
                    logger.warning(f"AI move failed in game {self.game_id}: {ai_result.get('message')}")
                # else: game was already ended by clock task or other error
                return

            if ai_result['success']:
                # Broadcast AI move
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'ai_move',
                        'data': {
                            'move': ai_result['move'],
                            'game_state': ai_result['game_state'],
                            'stats': ai_result.get('stats', {}),
                            'player_one_time_ms': ai_result.get('player_one_time_ms'),
                            'player_two_time_ms': ai_result.get('player_two_time_ms'),
                            'clock_running': ai_result.get('clock_running', False)
                        }
                    }
                )

                # Start clock for player if game continues
                if ai_result.get('clock_running'):
                    await self.start_clock()

                # Check if game is over
                if ai_result.get('game_over'):
                    # Determine the reason for game over
                    reason = 'no_moves'  # Default: opponent has no valid moves
                    if ai_result.get('captured_all'):
                        reason = 'capture'  # All pieces captured

                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'game_over',
                            'data': {
                                'winner': ai_result.get('winner'),
                                'ai_won': ai_result.get('ai_won', False),
                                'reason': reason,
                                'rating_changes': ai_result.get('rating_changes')
                            }
                        }
                    )
        except Exception as e:
            logger.error(f"Error in trigger_ai_move for game {self.game_id}: {e}", exc_info=True)

    async def handle_request_state(self, data: Dict[str, Any]):
        """Send current game state."""
        game_state = await self.get_game_state()
        await self.send_json({
            'type': 'game_state',
            'data': game_state
        })

        # Start clock if it should be running (handles reconnection case)
        if game_state and game_state.get('clock_running'):
            await self.start_clock()

    async def handle_forfeit(self, data: Dict[str, Any]):
        """Handle player forfeit."""
        result = await self.process_forfeit()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_over',
                'data': result
            }
        )

    async def handle_request_rematch(self, data: Dict[str, Any]):
        """Handle rematch request."""
        user_id = str(self.user.id) if self.user and self.user.is_authenticated else None

        # For PvE games, create new game immediately
        game_mode = await self.get_game_mode()
        if game_mode == 'pve':
            new_game = await self.create_rematch_game()
            if new_game:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'rematch_created',
                        'data': {
                            'new_game_id': str(new_game['id']),
                            'player_id': user_id
                        }
                    }
                )
            return

        # For PvP games, send rematch request to opponent
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'rematch_requested',
                'data': {'player_id': user_id}
            }
        )

    async def handle_accept_rematch(self, data: Dict[str, Any]):
        """Handle rematch acceptance - create new game."""
        user_id = str(self.user.id) if self.user and self.user.is_authenticated else None

        new_game = await self.create_rematch_game()
        if new_game:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'rematch_accepted',
                    'data': {
                        'new_game_id': str(new_game['id']),
                        'player_id': user_id
                    }
                }
            )
        else:
            await self.send_json({
                'type': 'error',
                'data': {'message': 'Failed to create rematch game'}
            })

    async def handle_decline_rematch(self, data: Dict[str, Any]):
        """Handle rematch decline."""
        user_id = str(self.user.id) if self.user and self.user.is_authenticated else None
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'rematch_declined',
                'data': {'player_id': user_id}
            }
        )

    async def handle_chat_message(self, data: Dict[str, Any]):
        """Handle chat messages during game."""
        user_id = str(self.user.id) if self.user and self.user.is_authenticated else 'anonymous'
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'data': {
                    'player_id': user_id,
                    'message': data.get('message', '')[:200]  # Limit message length
                }
            }
        )

    # Group message handlers
    async def game_update(self, event):
        """Send game update to client."""
        await self.send_json({
            'type': 'game_update',
            'data': event['data']
        })

    async def ai_move(self, event):
        """Send AI move to client."""
        await self.send_json({
            'type': 'ai_move',
            'data': event['data']
        })

    async def game_over(self, event):
        """Send game over to client."""
        await self.send_json({
            'type': 'game_over',
            'data': event['data']
        })

    async def player_disconnected(self, event):
        """Send player disconnected to client."""
        await self.send_json({
            'type': 'player_disconnected',
            'data': {'player_id': event['player_id']}
        })

    async def rematch_requested(self, event):
        """Send rematch requested to client."""
        await self.send_json({
            'type': 'rematch_requested',
            'data': event['data']
        })

    async def rematch_accepted(self, event):
        """Send rematch accepted to client."""
        await self.send_json({
            'type': 'rematch_accepted',
            'data': event['data']
        })

    async def rematch_declined(self, event):
        """Send rematch declined to client."""
        await self.send_json({
            'type': 'rematch_declined',
            'data': event['data']
        })

    async def rematch_created(self, event):
        """Send rematch created to client (for PvE)."""
        await self.send_json({
            'type': 'rematch_created',
            'data': event['data']
        })

    async def chat_message(self, event):
        """Send chat message to client."""
        await self.send_json({
            'type': 'chat_message',
            'data': event['data']
        })

    # Clock management
    async def start_clock(self):
        """Start the clock for the current player."""
        # Update last_move_timestamp and clock_running
        await self.update_clock_start()

        # Cancel existing clock task
        if self.clock_task:
            self.clock_task.cancel()

        # Start new clock task
        self.clock_task = asyncio.create_task(self.clock_tick())

    async def stop_clock(self):
        """Stop the clock and calculate elapsed time."""
        if self.clock_task:
            self.clock_task.cancel()
            self.clock_task = None

    async def clock_tick(self):
        """Broadcast clock updates every 100ms and check for timeout."""
        try:
            while True:
                await asyncio.sleep(0.1)  # 100ms tick

                # Get current time data
                time_data = await self.get_clock_state()
                if not time_data:
                    break

                if not time_data.get('clock_running'):
                    break

                # Check for timeout
                active_player = time_data.get('current_player')
                if active_player == 1 and time_data.get('player_one_time_ms', 0) <= 0:
                    await self.handle_timeout(1)
                    break
                elif active_player == 2 and time_data.get('player_two_time_ms', 0) <= 0:
                    await self.handle_timeout(2)
                    break

                # Broadcast clock update
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'clock_update',
                        'data': {
                            'player_one_time_ms': time_data.get('player_one_time_ms'),
                            'player_two_time_ms': time_data.get('player_two_time_ms'),
                            'active_player': active_player
                        }
                    }
                )
        except asyncio.CancelledError:
            pass

    async def handle_timeout(self, player: int):
        """Handle timeout - end game with winner."""
        result = await self.process_timeout(player)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_over',
                'data': result
            }
        )

    async def clock_update(self, event):
        """Send clock update to client."""
        await self.send_json({
            'type': 'clock_update',
            'data': event['data']
        })

    # Database operations
    @database_sync_to_async
    def get_game_state(self) -> Optional[Dict]:
        """Get current game state."""
        try:
            game = GameSession.objects.select_related('player_one', 'player_two').get(id=self.game_id)

            # Calculate current time remaining
            player_one_time = game.player_one_time_ms
            player_two_time = game.player_two_time_ms

            if game.clock_running and game.last_move_timestamp:
                elapsed_ms = int((timezone.now() - game.last_move_timestamp).total_seconds() * 1000)
                state = game.game_state
                current_player = state.get('current_player', 1)

                if current_player == 1 and player_one_time is not None:
                    player_one_time = max(0, player_one_time - elapsed_ms)
                elif current_player == 2 and player_two_time is not None:
                    player_two_time = max(0, player_two_time - elapsed_ms)

            return {
                'game_state': game.game_state,
                'status': game.status,
                'mode': game.mode,
                'pvp_type': game.pvp_type,
                'difficulty': game.difficulty,
                'player_one_id': str(game.player_one.id) if game.player_one else None,
                'player_two_id': str(game.player_two.id) if game.player_two else None,
                'player_one_username': game.player_one.username if game.player_one else 'Player 1',
                'player_two_username': game.player_two.username if game.player_two else ('AI' if game.mode == 'pve' else 'Player 2'),
                'time_control': game.time_control,
                'initial_time_seconds': game.initial_time_seconds,
                'increment_seconds': game.increment_seconds,
                'player_one_time_ms': player_one_time,
                'player_two_time_ms': player_two_time,
                'clock_running': game.clock_running,
            }
        except GameSession.DoesNotExist:
            return None

    @database_sync_to_async
    def get_clock_state(self) -> Optional[Dict]:
        """Get current clock state with calculated time."""
        try:
            game = GameSession.objects.get(id=self.game_id)

            if not game.clock_running:
                return {'clock_running': False}

            player_one_time = game.player_one_time_ms
            player_two_time = game.player_two_time_ms

            if game.last_move_timestamp:
                elapsed_ms = int((timezone.now() - game.last_move_timestamp).total_seconds() * 1000)
                current_player = game.game_state.get('current_player', 1)

                if current_player == 1 and player_one_time is not None:
                    player_one_time = max(0, player_one_time - elapsed_ms)
                elif current_player == 2 and player_two_time is not None:
                    player_two_time = max(0, player_two_time - elapsed_ms)

            return {
                'clock_running': True,
                'player_one_time_ms': player_one_time,
                'player_two_time_ms': player_two_time,
                'current_player': game.game_state.get('current_player', 1)
            }
        except GameSession.DoesNotExist:
            return None

    @database_sync_to_async
    def update_clock_start(self):
        """Mark clock as running and set timestamp."""
        try:
            game = GameSession.objects.get(id=self.game_id)
            if game.time_control != 'unlimited' and game.player_one_time_ms is not None:
                game.clock_running = True
                game.last_move_timestamp = timezone.now()
                game.save(update_fields=['clock_running', 'last_move_timestamp'])
        except GameSession.DoesNotExist:
            pass

    @database_sync_to_async
    def is_clock_running(self) -> bool:
        """Check if clock is currently running."""
        try:
            game = GameSession.objects.get(id=self.game_id)
            return game.clock_running and game.time_control != 'unlimited'
        except GameSession.DoesNotExist:
            return False

    @database_sync_to_async
    def process_timeout(self, timed_out_player: int) -> Dict:
        """Process timeout - end game."""
        try:
            with transaction.atomic():
                # Lock the game row to prevent race conditions with AI move calculation
                game = GameSession.objects.select_for_update().get(id=self.game_id)

                # Check if game is still in progress
                if game.status != GameSession.GameStatus.IN_PROGRESS:
                    return {'winner_id': None, 'reason': 'already_ended'}

                game.status = GameSession.GameStatus.COMPLETED
                game.completed_at = timezone.now()
                game.clock_running = False

                # Update game state to reflect timeout
                state = GameState.from_dict(game.game_state)
                state.phase = GamePhase.FINISHED

                winner_id = None
                ai_won = False

                if timed_out_player == 1:
                    # Player 1 timed out, player 2 wins
                    state.winner = PieceType.PLAYER_TWO
                    if game.mode == GameSession.GameMode.PVE:
                        game.ai_won = True
                        ai_won = True
                    else:
                        game.winner = game.player_two
                        winner_id = str(game.player_two.id) if game.player_two else None
                else:
                    # Player 2 timed out, player 1 wins
                    state.winner = PieceType.PLAYER_ONE
                    game.winner = game.player_one
                    winner_id = str(game.player_one.id) if game.player_one else None

                game.game_state = state.to_dict()
                game.save()

                # Update ELO ratings for PvP games
                rating_changes = update_ratings_for_game(game)

                return {
                    'winner_id': winner_id,
                    'ai_won': ai_won,
                    'reason': 'timeout',
                    'timed_out_player': timed_out_player,
                    'rating_changes': rating_changes
                }
        except GameSession.DoesNotExist:
            return {'winner_id': None, 'reason': 'game_not_found'}

    @database_sync_to_async
    def process_move(self, move: Move) -> Dict:
        """Process a player move with atomic transaction."""
        try:
            with transaction.atomic():
                # Lock the game row for update to prevent race conditions
                game = GameSession.objects.select_for_update().get(id=self.game_id)
                state = GameState.from_dict(game.game_state)

                # Validate move
                if not GameRules.is_valid_move(state, move):
                    return {'success': False, 'message': 'Invalid move'}

                # Handle time control - stop clock and add increment
                has_time_control = game.time_control != 'unlimited' and game.player_one_time_ms is not None
                player_one_time = game.player_one_time_ms
                player_two_time = game.player_two_time_ms

                if has_time_control and game.clock_running and game.last_move_timestamp:
                    elapsed_ms = int((timezone.now() - game.last_move_timestamp).total_seconds() * 1000)
                    current_player = state.current_player

                    if current_player == PieceType.PLAYER_ONE:
                        player_one_time = max(0, player_one_time - elapsed_ms)
                        # Add increment
                        player_one_time += game.increment_seconds * 1000
                    else:
                        player_two_time = max(0, player_two_time - elapsed_ms)
                        player_two_time += game.increment_seconds * 1000

                    game.player_one_time_ms = player_one_time
                    game.player_two_time_ms = player_two_time

                # Apply move
                new_state = state.apply_move(move)

                # Record move
                GameMove.objects.create(
                    game=game,
                    player=self.user if self.user and self.user.is_authenticated else None,
                    move_number=len(game.move_history) + 1,
                    from_position=move.from_pos.to_dict(),
                    to_position=move.to_pos.to_dict(),
                    captured_position=move.captured.to_dict() if move.captured else None
                )

                # Check for winner
                winner = GameRules.check_winner(new_state)
                rating_changes = None
                game_over = False
                ai_won = False
                captured_all = False
                winner_id = None

                if winner:
                    new_state.winner = winner
                    new_state.phase = GamePhase.FINISHED
                    game.status = GameSession.GameStatus.COMPLETED
                    game.completed_at = timezone.now()
                    game.clock_running = False  # Stop clock on game end
                    game_over = True

                    # Check if win was by capturing all pieces
                    opponent_pieces = new_state.board.count_pieces(
                        PieceType.PLAYER_ONE if winner == PieceType.PLAYER_TWO else PieceType.PLAYER_TWO
                    )
                    captured_all = opponent_pieces == 0

                    if winner == PieceType.PLAYER_ONE:
                        game.winner = game.player_one
                        winner_id = str(game.player_one.id) if game.player_one else None
                    elif winner == PieceType.PLAYER_TWO:
                        if game.mode == GameSession.GameMode.PVE:
                            game.ai_won = True
                            ai_won = True
                        else:
                            game.winner = game.player_two
                            winner_id = str(game.player_two.id) if game.player_two else None
                else:
                    # Start clock for next player
                    if has_time_control:
                        game.last_move_timestamp = timezone.now()
                        game.clock_running = True

                # Save state
                game.game_state = new_state.to_dict()
                game.move_history.append(move.to_dict())
                game.save()

                # Update ELO ratings if game ended
                if winner:
                    rating_changes = update_ratings_for_game(game)

                # Check if AI should move next
                is_ai_turn = (
                    game.mode == GameSession.GameMode.PVE and
                    not winner and
                    new_state.current_player == PieceType.PLAYER_TWO
                )

                return {
                    'success': True,
                    'game_state': new_state.to_dict(),
                    'ai_turn': is_ai_turn,
                    'game_over': game_over,
                    'winner': winner,
                    'winner_id': winner_id,
                    'ai_won': ai_won,
                    'captured_all': captured_all,
                    'player_one_time_ms': player_one_time,
                    'player_two_time_ms': player_two_time,
                    'clock_running': game.clock_running and not winner,
                    'rating_changes': rating_changes
                }
        except GameSession.DoesNotExist:
            return {'success': False, 'message': 'Game not found'}

    @database_sync_to_async
    def calculate_ai_move(self) -> Dict:
        """Calculate and apply AI move with atomic transaction."""
        try:
            with transaction.atomic():
                # Lock the game row for update to prevent race conditions
                game = GameSession.objects.select_for_update().get(id=self.game_id)

                # Check if game is still in progress (may have timed out while AI was thinking)
                if game.status != GameSession.GameStatus.IN_PROGRESS:
                    return {'success': False, 'message': 'Game is no longer in progress'}

                state = GameState.from_dict(game.game_state)

                # Handle time control - check if AI has timed out
                has_time_control = game.time_control != 'unlimited' and game.player_two_time_ms is not None
                player_one_time = game.player_one_time_ms
                player_two_time = game.player_two_time_ms

                # Calculate elapsed time for AI (player 2) and check for timeout
                calculation_start_time = timezone.now()
                if has_time_control and game.clock_running and game.last_move_timestamp:
                    elapsed_ms = int((calculation_start_time - game.last_move_timestamp).total_seconds() * 1000)
                    player_two_time = max(0, player_two_time - elapsed_ms)

                    # If AI ran out of time, don't make a move
                    if player_two_time <= 0:
                        return {'success': False, 'timed_out': True}

                # Get AI based on difficulty
                ai = AIFactory.create_by_difficulty(game.difficulty)
                ai_move = ai.get_best_move(state)

                if not ai_move:
                    return {'success': False, 'message': 'AI could not find a move'}

                # Re-check timeout before applying move (in case AI calculation took a long time)
                if has_time_control and game.clock_running:
                    # Calculate ADDITIONAL time spent during AI calculation
                    additional_time_ms = int((timezone.now() - calculation_start_time).total_seconds() * 1000)
                    player_two_time = max(0, player_two_time - additional_time_ms)
                    if player_two_time <= 0:
                        return {'success': False, 'timed_out': True}

                # Validate AI move to prevent corrupted game state
                if not GameRules.is_valid_move(state, ai_move):
                    # AI produced invalid move - log warning and fall back to first valid move
                    logger.warning(
                        f"AI (difficulty={game.difficulty}) produced invalid move "
                        f"from={ai_move.from_pos.to_dict()} to={ai_move.to_pos.to_dict()} "
                        f"in game={game.id}. Falling back to random valid move."
                    )
                    valid_moves = GameRules.get_valid_moves(state)
                    if not valid_moves:
                        return {'success': False, 'message': 'No valid moves available'}
                    ai_move = valid_moves[0]

                # Apply AI move
                new_state = state.apply_move(ai_move)

                # Record AI move
                GameMove.objects.create(
                    game=game,
                    is_ai_move=True,
                    move_number=len(game.move_history) + 1,
                    from_position=ai_move.from_pos.to_dict(),
                    to_position=ai_move.to_pos.to_dict(),
                    captured_position=ai_move.captured.to_dict() if ai_move.captured else None
                )

                # Check for winner
                winner = GameRules.check_winner(new_state)
                game_over = False
                ai_won = False
                captured_all = False

                if winner:
                    new_state.winner = winner
                    new_state.phase = GamePhase.FINISHED
                    game.status = GameSession.GameStatus.COMPLETED
                    game.completed_at = timezone.now()
                    game.clock_running = False  # Stop clock on game end
                    game_over = True

                    # Check if win was by capturing all pieces
                    opponent_pieces = new_state.board.count_pieces(
                        PieceType.PLAYER_ONE if winner == PieceType.PLAYER_TWO else PieceType.PLAYER_TWO
                    )
                    captured_all = opponent_pieces == 0

                    if winner == PieceType.PLAYER_TWO:
                        game.ai_won = True
                        ai_won = True
                    else:
                        game.winner = game.player_one
                else:
                    # Update AI time with increment (after move is complete)
                    if has_time_control:
                        # AI time was already reduced by elapsed time, now add increment
                        player_two_time += game.increment_seconds * 1000
                        game.player_two_time_ms = player_two_time
                        # Start clock for player 1
                        game.last_move_timestamp = timezone.now()
                        game.clock_running = True

                # Save state
                game.game_state = new_state.to_dict()
                game.move_history.append(ai_move.to_dict())
                game.save()

                # Update ELO ratings if game ended
                rating_changes = None
                if game_over:
                    rating_changes = update_ratings_for_game(game)

                return {
                    'success': True,
                    'move': ai_move.to_dict(),
                    'game_state': new_state.to_dict(),
                    'stats': ai.get_stats(),
                    'game_over': game_over,
                    'winner': winner,
                    'ai_won': ai_won,
                    'captured_all': captured_all,
                    'player_one_time_ms': player_one_time,
                    'player_two_time_ms': player_two_time,
                    'clock_running': game.clock_running and not game_over,
                    'rating_changes': rating_changes
                }
        except GameSession.DoesNotExist:
            return {'success': False, 'message': 'Game not found'}

    @database_sync_to_async
    def process_forfeit(self) -> Dict:
        """Process player forfeit."""
        try:
            game = GameSession.objects.get(id=self.game_id)

            game.status = GameSession.GameStatus.COMPLETED
            game.completed_at = timezone.now()
            game.clock_running = False

            winner_id = None
            ai_won = False

            if game.mode == GameSession.GameMode.PVE:
                game.ai_won = True
                ai_won = True
            elif self.user and self.user.is_authenticated:
                if self.user == game.player_one:
                    game.winner = game.player_two
                else:
                    game.winner = game.player_one
                winner_id = str(game.winner.id) if game.winner else None

            game.save()

            # Update ELO ratings for PvP games
            rating_changes = update_ratings_for_game(game)

            return {
                'winner_id': winner_id,
                'ai_won': ai_won,
                'reason': 'forfeit',
                'rating_changes': rating_changes
            }
        except GameSession.DoesNotExist:
            return {'winner_id': None, 'reason': 'game_not_found'}

    @database_sync_to_async
    def get_game_mode(self) -> str:
        """Get the game mode (pve or pvp)."""
        try:
            game = GameSession.objects.get(id=self.game_id)
            return game.mode
        except GameSession.DoesNotExist:
            return 'pve'

    @database_sync_to_async
    def create_rematch_game(self) -> Optional[Dict]:
        """Create a new game with the same settings as the current game."""
        try:
            original_game = GameSession.objects.get(id=self.game_id)

            # Create initial game state
            from .engine import GameState
            initial_state = GameState.create_initial_state(original_game.board_size)

            # Swap players for rematch in PvP (loser gets first move)
            if original_game.mode == GameSession.GameMode.PVP:
                # Swap player positions
                player_one = original_game.player_two
                player_two = original_game.player_one
            else:
                # PvE keeps the same player
                player_one = original_game.player_one
                player_two = None

            # Create new game
            new_game = GameSession.objects.create(
                player_one=player_one,
                player_two=player_two,
                mode=original_game.mode,
                difficulty=original_game.difficulty,
                board_size=original_game.board_size,
                time_control=original_game.time_control,
                initial_time_seconds=original_game.initial_time_seconds,
                increment_seconds=original_game.increment_seconds,
                player_one_time_ms=original_game.initial_time_seconds * 1000 if original_game.time_control != 'unlimited' else None,
                player_two_time_ms=original_game.initial_time_seconds * 1000 if original_game.time_control != 'unlimited' else None,
                game_state=initial_state.to_dict(),
                status=GameSession.GameStatus.IN_PROGRESS,
            )

            return {
                'id': new_game.id,
                'mode': new_game.mode,
            }
        except GameSession.DoesNotExist:
            return None


# In-memory storage for lobby data (in production, use Redis)
lobby_users = {}  # {channel_name: {'user_id': str, 'username': str, 'rating': int}}
matchmaking_queues = {
    'online_ranked': [],   # List of {channel_name, user_id, username, rating, time_control}
    'online_unranked': [], # List of {channel_name, user_id, username, time_control}
}


class LobbyConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for lobby, online players, and matchmaking."""

    LOBBY_GROUP = 'lobby_main'

    async def connect(self):
        """Handle lobby connection."""
        self.user = self.scope.get('user')

        # Must be authenticated to use lobby
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        await self.channel_layer.group_add(
            self.LOBBY_GROUP,
            self.channel_name
        )

        await self.accept()

        # Add user to online list
        user_data = await self.get_user_data()
        lobby_users[self.channel_name] = user_data

        # Broadcast updated online list to all users
        await self.broadcast_online_players()

        # Send current online list to the connected user
        await self.send_json({
            'type': 'online_players',
            'data': {
                'players': list(lobby_users.values()),
                'count': len(lobby_users)
            }
        })

    async def disconnect(self, close_code):
        """Handle lobby disconnection."""
        # Remove from online list
        if self.channel_name in lobby_users:
            del lobby_users[self.channel_name]

        # Remove from matchmaking queues
        for queue_type in matchmaking_queues:
            matchmaking_queues[queue_type] = [
                p for p in matchmaking_queues[queue_type]
                if p['channel_name'] != self.channel_name
            ]

        # Leave lobby group
        await self.channel_layer.group_discard(
            self.LOBBY_GROUP,
            self.channel_name
        )

        # Broadcast updated online list
        await self.broadcast_online_players()

    async def receive_json(self, content):
        """Handle incoming messages."""
        msg_type = content.get('type')

        if msg_type == 'join_queue':
            await self.handle_join_queue(content.get('data', {}))
        elif msg_type == 'leave_queue':
            await self.handle_leave_queue()
        elif msg_type == 'get_online_players':
            await self.send_json({
                'type': 'online_players',
                'data': {
                    'players': list(lobby_users.values()),
                    'count': len(lobby_users)
                }
            })

    async def handle_join_queue(self, data):
        """Handle joining matchmaking queue."""
        queue_type = data.get('pvp_type', 'online_ranked')
        time_control = data.get('time_control', 'unlimited')
        initial_time = data.get('initial_time_seconds', 0)
        increment = data.get('increment_seconds', 0)

        if queue_type not in matchmaking_queues:
            await self.send_json({
                'type': 'error',
                'data': {'message': 'Invalid queue type'}
            })
            return

        # Remove from any existing queue first
        for qt in matchmaking_queues:
            matchmaking_queues[qt] = [
                p for p in matchmaking_queues[qt]
                if p['channel_name'] != self.channel_name
            ]

        # Add to queue
        user_data = await self.get_user_data()
        queue_entry = {
            'channel_name': self.channel_name,
            'user_id': user_data['user_id'],
            'username': user_data['username'],
            'rating': user_data.get('rating', 1200),
            'time_control': time_control,
            'initial_time_seconds': initial_time,
            'increment_seconds': increment,
        }
        matchmaking_queues[queue_type].append(queue_entry)

        # Send queue confirmation
        await self.send_json({
            'type': 'queue_joined',
            'data': {
                'queue_type': queue_type,
                'position': len(matchmaking_queues[queue_type]),
                'players_waiting': len(matchmaking_queues[queue_type])
            }
        })

        # Try to find a match
        await self.try_match(queue_type)

    async def handle_leave_queue(self):
        """Handle leaving matchmaking queue."""
        for queue_type in matchmaking_queues:
            matchmaking_queues[queue_type] = [
                p for p in matchmaking_queues[queue_type]
                if p['channel_name'] != self.channel_name
            ]

        await self.send_json({
            'type': 'queue_left',
            'data': {}
        })

    async def try_match(self, queue_type: str):
        """Try to match players in the queue."""
        queue = matchmaking_queues[queue_type]

        # Simple matching: pair first two players with same time control
        if len(queue) < 2:
            return

        # Group by time control
        by_time_control = {}
        for player in queue:
            key = (player['time_control'], player.get('initial_time_seconds', 0), player.get('increment_seconds', 0))
            if key not in by_time_control:
                by_time_control[key] = []
            by_time_control[key].append(player)

        # Find a match
        for (tc, initial, increment), players in by_time_control.items():
            if len(players) >= 2:
                player1 = players[0]
                player2 = players[1]

                # Remove matched players from queue
                matchmaking_queues[queue_type] = [
                    p for p in matchmaking_queues[queue_type]
                    if p['channel_name'] not in [player1['channel_name'], player2['channel_name']]
                ]

                # Create the game
                game_data = await self.create_pvp_game(player1, player2, queue_type, tc, initial, increment)

                if game_data:
                    # Notify both players
                    for player in [player1, player2]:
                        await self.channel_layer.send(
                            player['channel_name'],
                            {
                                'type': 'match_found',
                                'game_id': str(game_data['id']),
                                'opponent': player2['username'] if player == player1 else player1['username'],
                            }
                        )
                break

    async def match_found(self, event):
        """Handle match found message."""
        await self.send_json({
            'type': 'match_found',
            'data': {
                'game_id': event['game_id'],
                'opponent': event['opponent']
            }
        })

    async def broadcast_online_players(self):
        """Broadcast online players list to all lobby users."""
        await self.channel_layer.group_send(
            self.LOBBY_GROUP,
            {
                'type': 'online_players_update',
                'players': list(lobby_users.values()),
                'count': len(lobby_users)
            }
        )

    async def online_players_update(self, event):
        """Handle online players update broadcast."""
        await self.send_json({
            'type': 'online_players',
            'data': {
                'players': event['players'],
                'count': event['count']
            }
        })

    @database_sync_to_async
    def get_user_data(self) -> dict:
        """Get user data for lobby display."""
        if not self.user or not self.user.is_authenticated:
            return {'user_id': None, 'username': 'Anonymous', 'rating': 1200}

        return {
            'user_id': str(self.user.id),
            'username': self.user.username,
            'rating': getattr(self.user, 'elo_rating', 1200),
        }

    @database_sync_to_async
    def create_pvp_game(self, player1: dict, player2: dict, pvp_type: str, time_control: str, initial_time: int, increment: int) -> Optional[dict]:
        """Create a new PvP game for matched players."""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        try:
            user1 = User.objects.get(id=player1['user_id'])
            user2 = User.objects.get(id=player2['user_id'])

            initial_state = GameState.create_initial_state(board_size=5)

            game = GameSession.objects.create(
                player_one=user1,
                player_two=user2,
                mode=GameSession.GameMode.PVP,
                pvp_type=pvp_type,
                status=GameSession.GameStatus.IN_PROGRESS,
                board_size=5,
                time_control=time_control,
                initial_time_seconds=initial_time,
                increment_seconds=increment,
                player_one_time_ms=initial_time * 1000 if time_control != 'unlimited' else None,
                player_two_time_ms=initial_time * 1000 if time_control != 'unlimited' else None,
                game_state=initial_state.to_dict(),
            )

            return {'id': game.id}
        except Exception as e:
            logger.error(f"Failed to create PvP game: {e}")
            return None
