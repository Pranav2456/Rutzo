import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, Facedowncard, EmptySlot } from "@/components";
import useGameState from "@/hooks/useGameState";
import { useApi, useAccount, useAlert } from "@gear-js/react-hooks";
import { MAIN_CONTRACT } from "@/app/consts";
import { ProgramMetadata } from "@gear-js/api";
import { CardProps } from "@/interfaces/Card";

const POLLING_INTERVAL = 2000; // Poll every 2 seconds
const MAX_POLLING_ATTEMPTS = 10;

export function BoardGame2() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedCards = location.state?.selectedCards || [];
  const playWithBot = location.state?.playWithBot ?? true; // Default to bot mode

  const { api } = useApi();
  const { account } = useAccount();
  const alert = useAlert();

  const {
    userPressPlayButton,
    tokensForOwnerState,
    cardToPlay,
    nftsLoaded,
    userInMatch,
    matchInProgress,
    setMatchInProgress,
    setEnemyCard,
    setEnemyCardCount,
    setUserInMatch,
    actualUserInMatch,
    enemyCard,
    enemyCardCount,
    userWonTheMatch,
    handlePlayButton,
    cardSelected,
    getMatchDetails,
    enemyName,
    addCardToPlay,
    removeCardToPlay,
    setUserWonTheMatch,
    resetBoard,
    getCurrentUserMatch,
    sendPlayCardTransaction,
    sendJoinGameTransaction,
  } = useGameState();

  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [timeLeft, setTimeLeft] = useState(180);
  const [showDialog, setShowDialog] = useState(false);
  const [currentMatchId, setCurrentMatchId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundResult, setRoundResult] = useState<string | null>(null);

  // Poll game state
  const pollGameState = useCallback(async () => {
    if (!api || !account || !currentMatchId) return;

    try {
      const [roundStateResult, matchStateResult] = await Promise.all([
        api.programState.read(
          {
            programId: MAIN_CONTRACT.PROGRAM_ID,
            payload: { RoundInformationFromGameId: currentMatchId },
          },
          ProgramMetadata.from(MAIN_CONTRACT.METADATA)
        ),

        api.programState.read(
          {
            programId: MAIN_CONTRACT.PROGRAM_ID,
            payload: { MatchStateById: currentMatchId },
          },
          ProgramMetadata.from(MAIN_CONTRACT.METADATA)
        ),
      ]);

      const roundState = roundStateResult.toJSON()?.roundState;
      const matchState = matchStateResult.toJSON()?.matchState;

      if (roundState) {
        const isCurrentPlayerTurn =
          roundState.currentPlayer === account.decodedAddress;
        setIsPlayerTurn(isCurrentPlayerTurn);

        // Update enemy card if it's played
        if (roundState.lastPlayedCard && !isCurrentPlayerTurn) {
          setEnemyCard(roundState.lastPlayedCard);
          setEnemyCardCount((prev) => Math.max(0, prev - 1));
        }

        // Update round state
        if (roundState.round) {
          setCurrentRound(roundState.round);
        }
      }

      // Check match completion
      if (matchState) {
        if (matchState.finished) {
          const isDraw = matchState.finished.draw;
          const isWinner =
            !isDraw && matchState.finished.winner === account.decodedAddress;
          setUserWonTheMatch(isDraw ? null : isWinner);
          setMatchInProgress(false);
        } else if (matchState.roundFinished) {
          // Handle round completion
          setRoundResult(
            matchState.roundFinished.winner === account.decodedAddress
              ? "You won this round!"
              : matchState.roundFinished.draw
              ? "Round Draw!"
              : "You lost this round!"
          );
          setTimeout(() => setRoundResult(null), 3000);
        }
      }
    } catch (error) {
      console.error("Error polling game state:", error);
    }
  }, [api, account, currentMatchId]);

  // Setup polling when match is in progress
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (matchInProgress && currentMatchId) {
      pollInterval = setInterval(pollGameState, POLLING_INTERVAL);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [matchInProgress, currentMatchId, pollGameState]);

  // Handle card play
  const handleCardPlay = async (card: CardProps) => {
    if (!isPlayerTurn || !currentMatchId) {
      alert.error("Not your turn!");
      return;
    }

    try {
      setIsLoading(true);
      const cardId = Number(card[0]);

      // Send the card play transaction
      await sendPlayCardTransaction(cardId);

      // Update local state
      addCardToPlay(card);
      setIsPlayerTurn(false);

      // If playing with bot, start polling for response immediately
      if (playWithBot) {
        let attempts = 0;
        while (attempts < 5) {
          const roundInfo = await pollGameState();
          if (roundInfo?.lastPlayedCard) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          attempts++;
        }
      }
    } catch (error) {
      console.error("Error playing card:", error);
      alert.error("Failed to play card. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Start game implementation
  const startGame = async () => {
    if (selectedCards.length !== 3) {
        alert.error("Please select exactly 3 cards");
        return;
    }

    setIsLoading(true);
    setShowDialog(true);

    try {
        // Convert selected cards to IDs
        const selectedCardIds = selectedCards.map((card: CardProps) => Number(card[0]));
        
        // First send the join game transaction
        console.log("Sending join game transaction with cards:", selectedCardIds);
        await sendJoinGameTransaction(selectedCardIds);
        
        // Wait a bit for the transaction to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Poll for match ID and game details
        let matchFound = false;
        let attempts = 0;
        
        while (!matchFound && attempts < MAX_POLLING_ATTEMPTS) {
            try {
                const matchId = await getCurrentUserMatch();
                console.log("Polling for match ID:", matchId);
                
                if (matchId !== -1) {
                    console.log("Match found with ID:", matchId);
                    setCurrentMatchId(matchId);
                    setUserInMatch(true);
                    setMatchInProgress(true);
                    
                    // Get initial game details
                    const gameDetails = await api.programState.read({
                        programId: MAIN_CONTRACT.PROGRAM_ID,
                        payload: { GameInformationById: matchId }
                    }, ProgramMetadata.from(MAIN_CONTRACT.METADATA));

                    console.log("Game details:", gameDetails.toJSON());
                    
                    matchFound = true;
                } else {
                    console.log("No match found yet, attempt:", attempts + 1);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    attempts++;
                }
            } catch (error) {
                console.error("Error polling for match:", error);
                attempts++;
            }
        }

        if (!matchFound) {
            throw new Error("Failed to find match after multiple attempts");
        }

    } catch (error) {
        console.error("Error starting game:", error);
        alert.error("Failed to start game. Please try again.");
        resetBoard();
    } finally {
        setIsLoading(false);
        setShowDialog(false);
    }
};
  // Handle game navigation
  const handleNewGame = () => {
    resetBoard();
    setIsPlayerTurn(true);
    setUserWonTheMatch(null);
    setCurrentMatchId(null);
    navigate("/selection");
  };

  const handleGoHome = () => {
    resetBoard();
    setIsPlayerTurn(true);
    setUserWonTheMatch(null);
    setCurrentMatchId(null);
    navigate("/");
  };

  // Countdown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (showDialog && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      clearInterval(timer);
      setShowDialog(false);
      navigate("/play");
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [showDialog, timeLeft, navigate]);

  // Initialize match ID on mount
  useEffect(() => {
    const initMatchId = async () => {
      if (api && account) {
        const matchId = await getCurrentUserMatch();
        if (matchId !== -1) {
          setCurrentMatchId(matchId);
        }
      }
    };

    initMatchId();
  }, [api, account, getCurrentUserMatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetBoard();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-2">
      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      )}

      {/* Player info header */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-4">
        <div className="flex items-center mt-10">
          <img
            src="/player-avatar.jpg"
            alt="Player Avatar"
            className="w-10 h-10 rounded-full mr-2"
          />
          <p className="text-sm w-96 overflow-hidden whitespace-nowrap truncate">
            {actualUserInMatch}
          </p>
        </div>
        <div className="flex items-center">
          <p className="text-sm w-96 overflow-hidden whitespace-nowrap truncate mr-2">
            {enemyName ??
              (playWithBot ? "Bot Player" : "Waiting for opponent...")}
          </p>
          <img
            src="/enemy-avatar.jpg"
            alt="Enemy Avatar"
            className="w-10 h-10 rounded-full"
          />
        </div>
      </div>

      {/* Round and Turn indicator */}
      <div className="flex flex-col items-center mb-4">
        <div className="text-sm mb-2">Round {currentRound}/3</div>
        <div className="bg-gradient-to-r from-purple-800 to-green-500 rounded-xl p-2">
          <p className="text-sm font-bold">
            {isPlayerTurn ? "Your Turn" : "Enemy's Turn"}
          </p>
        </div>
      </div>

      {/* Round result notification */}
      {roundResult && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-800 to-green-500 rounded-xl p-4 z-50">
          <p className="text-lg font-bold">{roundResult}</p>
        </div>
      )}

      {/* Game board */}
      <div className="w-full max-w-5xl grid grid-cols-2 gap-4 mb-8">
        {/* Player side */}
        <div className="flex flex-col items-center">
          <div className="bg-slate-900 rounded-lg mb-4 p-2 flex items-center justify-center">
            {cardToPlay ? (
              <Card
                image={cardToPlay[1].media}
                title={cardToPlay[1].name}
                type={cardToPlay[1].description.toLowerCase()}
                value={cardToPlay[1].reference}
                onCardClick={() => isPlayerTurn && removeCardToPlay(cardToPlay)}
                scale={1}
              />
            ) : (
              <EmptySlot scale={1.0} />
            )}
          </div>
          <div className="flex justify-center space-x-2">
            {selectedCards.map((card: CardProps) => (
              <Card
                key={card[0]}
                image={card[1].media}
                title={card[1].name}
                type={card[1].description.toLowerCase()}
                value={card[1].reference}
                onCardClick={() => isPlayerTurn && handleCardPlay(card)}
                scale={0.6}
              />
            ))}
            {selectedCards.length < 3 &&
              Array.from(Array(3 - selectedCards.length).keys()).map(
                (index) => <EmptySlot key={`empty-${index}`} scale={0.6} />
              )}
          </div>
        </div>

        {/* Enemy side */}
        <div className="flex flex-col items-center">
          <div className="bg-slate-900 rounded-lg mb-4 p-2 flex items-center justify-center">
            {enemyCard ? (
              <Card
                image={enemyCard.media}
                title={enemyCard.name}
                type={enemyCard.description.toLowerCase()}
                value={enemyCard.reference}
                scale={1}
              />
            ) : (
              <Facedowncard scale={1} />
            )}
          </div>
          <div className="flex justify-center space-x-2">
            {Array.from({ length: enemyCardCount }).map((_, index) => (
              <Facedowncard key={`enemy-card-${index}`} scale={0.6} />
            ))}
          </div>
        </div>
      </div>

      {/* Game end modal */}
      {userWonTheMatch !== null && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-black text-white p-8 rounded-lg text-center border-2 border-violet-800">
            <h2 className="text-lg mb-4">
              {userWonTheMatch ? "You won! 🎉" : "You lost..."}
            </h2>
            <div className="flex space-x-4">
              <button
                onClick={handleNewGame}
                className="px-6 py-2 bg-gradient-to-r from-purple-800 to-green-500 text-white rounded-full"
              >
                New Game
              </button>
              <button
                onClick={handleGoHome}
                className="px-6 py-2 bg-gradient-to-r from-purple-800 to-green-500 text-white rounded-full"
              >
                Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Searching opponent dialog */}
      {showDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-black text-white p-8 rounded-lg text-center border-2 border-violet-800">
            <h2 className="text-lg mb-3">
              {playWithBot
                ? "Starting bot game..."
                : "Searching for an opponent..."}
            </h2>
            <p>
              Time left: {Math.floor(timeLeft / 60)}:
              {(timeLeft % 60).toString().padStart(2, "0")}
            </p>
            <button
              onClick={() => setShowDialog(false)}
              className="mt-4 px-6 py-2 bg-red-600 rounded-full"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Play button */}
      {!userInMatch && (
        <button
          className="fixed bottom-4 right-4 px-6 py-2 bg-green-500 rounded-full disabled:bg-gray-500"
          onClick={startGame}
          disabled={selectedCards.length !== 3}
        >
          Let's Go! {playWithBot ? "(vs Bot)" : "(vs Player)"}
        </button>
      )}
    </div>
  );
}

export default BoardGame2;
