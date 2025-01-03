import React from "react";
import { useNavigate } from "react-router-dom";
import useLocalBoard from "@/hooks/useLocalBoard";
import { Card } from "@/components";
import { FaTrash } from "react-icons/fa6";
import { useAccount } from "@gear-js/react-hooks";
import { CardProps } from "@/interfaces/Card";

const Selection = () => {
  // Only import what we need
  const { pushCard, removeCard, clearSelectedCards, board } = useLocalBoard();
  const navigate = useNavigate();
  const { account } = useAccount();

  const handleLetsGo = () => {
    if (!account) {
      alert("Please connect your wallet");
      return;
    }

    // Simply navigate with selected cards
    navigate("/fight", {
      state: { selectedCards: board.selectedCards },
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
              onCardClick={() => pushCard(card)}
            />
          ))}
        </div>
      </div>

      {/* Selected Cards Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-purple-800 to-green-500 text-white rounded-lg p-1">
            Selected Cards ({board.selectedCards.length}/3)
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
          disabled={board.selectedCards.length !== 3}
          className="px-6 py-2 bg-gradient-to-r from-purple-800 to-green-500 text-white rounded-full shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Let's go
        </button>
      </div>
    </div>
  );
};

export default Selection;