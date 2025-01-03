import { useState, useEffect, useCallback } from "react";
import { CardProps } from "@/interfaces/Card";
import useCardsData from "@/hooks/useCardsData";

const MAX_SELECTED_CARDS = 3;

const useLocalBoard = () => {
    const [availableCards, setAvailableCards] = useState<CardProps[]>([]);
    const [selectedCards, setSelectedCards] = useState<CardProps[]>([]);

    const { 
        allUserCards, 
        fetchData, 
        getPlayingCards,
        isLoading,
        error 
    } = useCardsData();

    useEffect(() => {
        const initData = async () => {
            await fetchData();
            await getPlayingCards();
        };
        initData();
    }, [fetchData, getPlayingCards]);

    useEffect(() => {
        setAvailableCards(allUserCards);
    }, [allUserCards]);

    const pushCard = useCallback((card: CardProps) => {
        if (selectedCards.length < MAX_SELECTED_CARDS) {
            setSelectedCards(prev => [...prev, card]);
            setAvailableCards(prev => prev.filter((c) => c[0] !== card[0]));
        }
    }, [selectedCards.length]);

    const removeCard = useCallback((card: CardProps) => {
        setSelectedCards(prev => prev.filter((c) => c[0] !== card[0]));
        setAvailableCards(prev => [...prev, card]);
    }, []);

    const clearSelectedCards = useCallback(() => {
        setAvailableCards(prev => [...prev, ...selectedCards]);
        setSelectedCards([]);
    }, [selectedCards]);

    return {
        pushCard,
        removeCard,
        clearSelectedCards,
        board: {
            availableCards,
            selectedCards
        },
        isLoading,
        error
    };
};

export default useLocalBoard;