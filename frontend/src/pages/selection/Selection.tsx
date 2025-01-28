import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useLocalBoard from "@/hooks/useLocalBoard";
import { Card } from "@/components";
import { FaTrash } from "react-icons/fa6";
import { useAccount, useAlert, useApi } from "@gear-js/react-hooks";
import { ProgramMetadata } from "@gear-js/api";
import { CardProps } from "@/interfaces/Card";
import { EventRecord, ExtrinsicStatus } from "@polkadot/types/interfaces";
import { web3FromSource } from "@polkadot/extension-dapp";
import { gasToSpend } from "@/app/utils";
import { MAIN_CONTRACT } from "@/app/consts";

const MAX_CARDS = 3;

const Selection = () => {
  const { pushCard, removeCard, clearSelectedCards, board } = useLocalBoard();
  const navigate = useNavigate();
  const { account } = useAccount();
  const alert = useAlert();
  const { api } = useApi();
  const [playWithBot, setPlayWithBot] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const mainContractMetadata = ProgramMetadata.from(MAIN_CONTRACT.METADATA);

  // Validate cards before proceeding
  const validateCards = (cards: CardProps[]) => {
    console.log("Validating selected cards:", cards);

    if (cards.length !== MAX_CARDS) {
      console.error(
        `Validation failed: Exactly ${MAX_CARDS} cards are required.`
      );
      alert.error(`Please select exactly ${MAX_CARDS} cards`);
      return false;
    }

    // Check if all cards have valid types and powers
    for (const card of cards) {
      const type = card[1].description.toLowerCase();
      const power = Number(card[1].reference);

      if (
        !["fire", "water", "rock", "ice", "dark", "fighting"].includes(type)
      ) {
        console.error(`Validation failed: Invalid card type - ${type}`);
        alert.error(`Invalid card type: ${type}`);
        return false;
      }

      if (isNaN(power) || power <= 0) {
        console.error(
          `Validation failed: Invalid card power - ${card[1].reference}`
        );
        alert.error(`Invalid card power: ${card[1].reference}`);
        return false;
      }
    }

    console.log("Validation successful.");
    return true;
  };

  const handleJoinGame = async () => {
    console.log("Attempting to join game with:", {
      selectedCards: board.selectedCards,
      playWithBot,
    });

    if (!api || !account) {
      console.error("API or account not available");
      alert.error("Please connect your wallet");
      return;
    }

    try {
      setIsJoining(true);

      // Extract card IDs from selected cards
      const selectedCardIds = board.selectedCards.map((card: CardProps) =>
        Number(card[0])
      );
      console.log("Selected card IDs:", selectedCardIds);

      // Calculate gas for the transaction
      const gas = await api.program.calculateGas.handle(
        account.decodedAddress,
        MAIN_CONTRACT.PROGRAM_ID,
        { JoinGame: { cards_id: selectedCardIds, play_with_bot: playWithBot } },
        0,
        false,
        mainContractMetadata
      );
      console.log("Calculated gas:", gas.toHuman());

      // Get signer from the wallet
      const { signer } = await web3FromSource(account.meta.source);

      // Prepare the transaction
      const joinGameExtrinsic = api.message.send(
        {
          destination: MAIN_CONTRACT.PROGRAM_ID,
          payload: {
            JoinGame: { cards_id: selectedCardIds, play_with_bot: playWithBot },
          },
          gasLimit: gasToSpend(gas),
          value: 0,
        },
        mainContractMetadata
      );

      let alertLoaderId: string | null = null;

      // Send the transaction
      await joinGameExtrinsic.signAndSend(
        account.decodedAddress,
        { signer },
        ({
          status,
          events,
        }: {
          status: ExtrinsicStatus;
          events: EventRecord[];
        }) => {
          if (!alertLoaderId) {
            alertLoaderId = alert.loading("Joining game...");
          }

          console.log(`Transaction status: ${status.type}`);

          if (status.isInBlock) {
            console.log(`Included in block: ${status.asInBlock.toString()}`);
          }

          if (status.isFinalized) {
            const success = events.some(
              ({ event: { method } }) => method === "ExtrinsicSuccess"
            );

            if (success) {
              console.log("Successfully joined game");
              alert.success("Successfully joined game!");
              navigate("/fight", {
                state: {
                  selectedCards: board.selectedCards,
                  playWithBot,
                },
              });
            } else {
              console.error("Failed to join game");
              alert.error("Failed to join game");
            }

            if (alertLoaderId) {
              alert.remove(alertLoaderId);
            }
            setIsJoining(false);
          }
        }
      );
    } catch (error) {
      console.error("Error joining game:", error);
      alert.error("Failed to join game. Please try again.");
      setIsJoining(false);
    }
  };

  const handleLetsGo = async () => {
    console.log("Let's Go button clicked");

    if (!account) {
      console.warn("No wallet connected");
      alert.error("Please connect your wallet");
      return;
    }

    if (!validateCards(board.selectedCards)) {
      console.warn("Selected cards validation failed.");
      return;
    }

    await handleJoinGame();
  };

  return (
    <div className="mx-32">
      <h1 className="text-3xl md:text-5xl font-semibold mb-6 text-center">
        Choose{" "}
        <span className="bg-gradient-to-r from-purple-800 to-green-500 rounded-xl p-1">
          your cards
        </span>
      </h1>

      {/* Game Mode Selection */}
      <div className="flex justify-center mb-8">
        <div className="flex gap-4 bg-gray-800 p-2 rounded-lg">
          <button
            onClick={() => {
              console.log("Game mode set to 'Play with Player'");
              setPlayWithBot(false);
            }}
            className={`px-4 py-2 rounded-lg ${
              !playWithBot
                ? "bg-gradient-to-r from-purple-800 to-green-500"
                : "bg-gray-700"
            }`}
          >
            Play with Player
          </button>
          <button
            onClick={() => {
              console.log("Game mode set to 'Play with Bot'");
              setPlayWithBot(true);
            }}
            className={`px-4 py-2 rounded-lg ${
              playWithBot
                ? "bg-gradient-to-r from-purple-800 to-green-500"
                : "bg-gray-700"
            }`}
          >
            Play with Bot
          </button>
        </div>
      </div>

      {/* Available Cards Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-purple-800 to-green-500 text-white rounded-lg p-1 mb-4">
          Available Cards
        </h2>
        <div className="flex flex-wrap justify-center gap-4">
          {board.availableCards.map((card: CardProps) => (
            <Card
              key={card[0]}
              image={card[1].media}
              title={card[1].name}
              type={card[1].description.toLowerCase()}
              value={card[1].reference}
              onCardClick={() => {
                if (board.selectedCards.length < MAX_CARDS) {
                  console.log("Adding card to selection:", card);
                  pushCard(card);
                } else {
                  console.warn(`Cannot select more than ${MAX_CARDS} cards.`);
                  alert.error(`Maximum ${MAX_CARDS} cards allowed`);
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Selected Cards Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-purple-800 to-green-500 text-white rounded-lg p-1">
            Selected Cards ({board.selectedCards.length}/{MAX_CARDS})
          </h2>
          {board.selectedCards.length > 0 && (
            <button
              onClick={() => {
                console.log("Clearing all selected cards");
                clearSelectedCards();
              }}
              className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-800 to-green-500 text-white rounded-full shadow-md hover:shadow-lg"
            >
              <FaTrash className="w-4 h-4 mr-2" />
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {board.selectedCards.map((card: CardProps) => (
            <Card
              key={card[0]}
              image={card[1].media}
              title={card[1].name}
              type={card[1].description.toLowerCase()}
              value={card[1].reference}
              onCardClick={() => {
                console.log("Removing card from selection:", card);
                removeCard(card);
              }}
            />
          ))}
          {board.selectedCards.length === 0 && (
            <p className="text-center text-white">No cards selected</p>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <button
          onClick={handleLetsGo}
          disabled={board.selectedCards.length !== MAX_CARDS || isJoining}
          className="px-6 py-2 bg-gradient-to-r from-purple-800 to-green-500 text-white rounded-full shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isJoining
            ? "Joining game..."
            : `Let's go ${playWithBot ? "vs Bot" : "vs Player"}`}
        </button>
      </div>
    </div>
  );
};

export default Selection;
