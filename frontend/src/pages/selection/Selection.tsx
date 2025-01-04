import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useLocalBoard from "@/hooks/useLocalBoard";
import { Card } from "@/components";
import { FaTrash } from "react-icons/fa6";
import { useAccount, useAlert } from "@gear-js/react-hooks";
import { CardProps } from "@/interfaces/Card";

const MAX_CARDS = 3;

const Selection = () => {
  const { pushCard, removeCard, clearSelectedCards, board } = useLocalBoard();
  const navigate = useNavigate();
  const { account } = useAccount();
  const alert = useAlert();
  const [playWithBot, setPlayWithBot] = useState(false);

  // Validate cards before proceeding
  const validateCards = (cards: CardProps[]) => {
    if (cards.length !== MAX_CARDS) {
      alert.error(`Please select exactly ${MAX_CARDS} cards`);
      return false;
    }

    // Check if all cards have valid types and powers
    for (const card of cards) {
      const type = card[1].description.toLowerCase();
      const power = Number(card[1].reference);

      if (!["fire", "water", "rock", "ice", "dark", "fighting"].includes(type)) {
        alert.error(`Invalid card type: ${type}`);
        return false;
      }

      if (isNaN(power) || power <= 0) {
        alert.error(`Invalid card power: ${card[1].reference}`);
        return false;
      }
    }

    return true;
  };

  const handleLetsGo = () => {
    if (!account) {
      alert.error("Please connect your wallet");
      return;
    }

    if (!validateCards(board.selectedCards)) {
      return;
    }

    // Navigate with selected cards and game mode
    navigate("/fight", {
      state: { 
        selectedCards: board.selectedCards,
        playWithBot 
      },
    });
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
            onClick={() => setPlayWithBot(false)}
            className={`px-4 py-2 rounded-lg ${
              !playWithBot 
                ? "bg-gradient-to-r from-purple-800 to-green-500" 
                : "bg-gray-700"
            }`}
          >
            Play with Player
          </button>
          <button
            onClick={() => setPlayWithBot(true)}
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
                  pushCard(card);
                } else {
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
              onClick={clearSelectedCards}
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
              onCardClick={() => removeCard(card)}
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
          disabled={board.selectedCards.length !== MAX_CARDS}
          className="px-6 py-2 bg-gradient-to-r from-purple-800 to-green-500 text-white rounded-full shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Let's go {playWithBot ? "vs Bot" : "vs Player"}
        </button>
      </div>
    </div>
  );
};

export default Selection;