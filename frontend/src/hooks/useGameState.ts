import { ProgramMetadata } from "@gear-js/api";
import { useState, useEffect, useCallback } from 'react';
import { useAccount, useAlert, useApi } from "@gear-js/react-hooks";
import { MAIN_CONTRACT, NFT_CONTRACT } from "@/app/consts";
import { sleepReact } from "@/app/utils";
import { useDispatch, useSelector } from "react-redux";
import { addCard } from "@/features/cardsSlice";
import { CardProps } from "@/interfaces/Card";
import { gasToSpend } from "@/app/utils";
import { web3FromSource } from "@polkadot/extension-dapp";

function useGameState() {
    const alert = useAlert();
    const { api } = useApi();
    const { account } = useAccount();
    
    // Game state
    const [userPressPlayButton, setUserPressPlayButton] = useState(false);
    const [tokensForOwnerState, setTokensForOwnerState] = useState<any>([]);
    const [selectedCards, setSelectedCards] = useState<any>([]);
    const [cardToPlay, setCardToPlay] = useState<any | null>(null);
    const [nftsLoaded, setNftsLoaded] = useState(false);
    const [userInMatch, setUserInMatch] = useState(false);
    const [matchInProgress, setMatchInProgress] = useState(false);
    const [actualUserInMatch, setActualUserInMatch] = useState("0x00");
    const [enemyName, setEnemyName] = useState<string | null>(null);
    const [enemyCard, setEnemyCard] = useState<any | null>(null);
    const [enemyCardCount, setEnemyCardCount] = useState<number>(0);
    const [userWonTheMatch, setUserWonTheMatch] = useState<boolean | null>(null);
    const [currentMatchId, setCurrentMatchId] = useState<number | null>(null);
    const setStateWithoutSelectedCards = useCallback((tokens: Array<any>, selected: Array<any>) => {
        try {
            const selectedIds = selected.map((card: any) => card[0]);
            setTokensForOwnerState(
                tokens.filter((token: any) => !selectedIds.includes(token[0]))
            );
        } catch (error) {
            console.error("Error filtering tokens:", error);
            // Fallback to setting all tokens if there's an error
            setTokensForOwnerState(tokens);
        }
    }, []);

    const mainContractMetadata = ProgramMetadata.from(MAIN_CONTRACT.METADATA);
    const nftContractMetadata = ProgramMetadata.from(NFT_CONTRACT.METADATA);

    const dispatch = useDispatch();
    const cards = useSelector((state: any) => state.cards.cards);

    // Reset all game state to initial values
    const resetBoard = useCallback(() => {
        setTokensForOwnerState([]);
        setSelectedCards([]);
        setCardToPlay(null);
        setUserInMatch(false);
        setMatchInProgress(false);
        setNftsLoaded(false);
        setUserPressPlayButton(false);
        setActualUserInMatch(account?.decodedAddress ?? "0x00");
        setUserWonTheMatch(null);
        setEnemyCard(null);
        setEnemyName(null);
        setEnemyCardCount(0);
        setCurrentMatchId(null);
    }, [account]);

    // Get current user's active match if any
    const getCurrentUserMatch = useCallback(async (): Promise<number> => {
        if (!api || !account?.decodedAddress) {
            console.error("API or account not available");
            return -1;
        }

        try {
            const stateResult = await api.programState.read({
                programId: MAIN_CONTRACT.PROGRAM_ID,
                payload: { PlayerIsInMatch: account.decodedAddress }
            }, mainContractMetadata);
            
            const { playerInMatch }: any = stateResult.toJSON();
            const matchId = playerInMatch ?? -1;
            if (matchId !== -1) {
                setCurrentMatchId(matchId);
            }
            return matchId;
        } catch (error) {
            console.error("Error reading program state:", error);
            return -1;
        }
    }, [api, account, mainContractMetadata]);

    // Get user's most recent match
    const getLastUserMatch = useCallback(async (): Promise<number> => {
        if (!api || !account?.decodedAddress) {
            console.error("API or account not available");
            return -1;
        }

        try {
            const stateResult = await api.programState.read({
                programId: MAIN_CONTRACT.PROGRAM_ID,
                payload: { PlayerInformation: account.decodedAddress }
            }, mainContractMetadata);
            
            const { playerInformation }: any = stateResult.toJSON();
            return playerInformation?.recentPastGame ?? -1;
        } catch (error) {
            console.error("Error reading player information:", error);
            return -1;
        }
    }, [api, account, mainContractMetadata]);

    // Get match round information
    const getRoundInformation = useCallback(async (matchId: number) => {
        if (!api || matchId === -1) return null;

        try {
            const response = await api.programState.read({
                programId: MAIN_CONTRACT.PROGRAM_ID,
                payload: { RoundInformationFromGameId: matchId }
            }, mainContractMetadata);
            
            return response.toJSON()?.roundState;
        } catch (error) {
            console.error("Error fetching round information:", error);
            return null;
        }
    }, [api, mainContractMetadata]);

    // Get details of a specific match
    const getMatchDetails = useCallback(async (matchId: number) => {
        if (!api || matchId === -1) return;

        try {
            const response = await api.programState.read({
                programId: MAIN_CONTRACT.PROGRAM_ID,
                payload: { GameInformationById: matchId }
            }, mainContractMetadata);
            
            const formattedState: any = response.toJSON();
            const { user1, user2 } = formattedState.gameInformation;
            
            if (account?.decodedAddress) {
                const opponent = user1.userId === account.decodedAddress ? user2 : user1;
                setEnemyName(opponent.userId);
                setEnemyCardCount(opponent.nftCount);
                if (opponent.nftData) {
                    setEnemyCard(opponent.nftData);
                }
            }

            return formattedState.gameInformation;
        } catch (error) {
            console.error("Error fetching match details:", error);
        }
    }, [api, account, mainContractMetadata]);

    // Send join game transaction
    const sendJoinGameTransaction = useCallback(async (selectedCardIds: number[]) => {
        if (!api || !account) {
            throw new Error("API or account not available");
        }
    
        try {
            const message = {
                destination: MAIN_CONTRACT.PROGRAM_ID,
                payload: {
                    JoinGame: {
                        cards_id: selectedCardIds,
                        play_with_bot: true // Using bot play for testing
                    }
                },
                gasLimit: 10000000,
                value: 0
            };
    
            // Calculate gas
            try {
                const gas = await api.program.calculateGas.handle(
                    account.decodedAddress,
                    MAIN_CONTRACT.PROGRAM_ID,
                    message.payload,
                    0,
                    false,
                    mainContractMetadata
                );
                message.gasLimit = Number(gasToSpend(gas));
            } catch (e) {
                console.warn("Failed to calculate gas, using default:", e);
            }
    
            const { signer } = await web3FromSource(account.meta.source);
            const joinGameExtrinsic = api.message.send(message, mainContractMetadata);
    
            return new Promise((resolve, reject) => {
                joinGameExtrinsic
                    .signAndSend(account.decodedAddress, { signer }, ({ status }) => {
                        if (status.isInBlock) {
                            console.log(`Completed at block hash #${status.asInBlock.toString()}`);
                            resolve(true);
                        } else {
                            console.log(`Current status: ${status.type}`);
                        }
                    })
                    .catch(reject);
            });
        } catch (error) {
            console.error("Error sending join game transaction:", error);
            throw error;
        }
    }, [api, account, mainContractMetadata]);

    const sendPlayCardTransaction = useCallback(async (cardId: number) => {
        if (!api || !account) {
            throw new Error("API or account not available");
        }
    
        try {
            const message = {
                destination: MAIN_CONTRACT.PROGRAM_ID,
                payload: {
                    ThrowCard: cardId
                },
                gasLimit: 10000000,
                value: 0
            };
    
            // Calculate gas
            try {
                const gas = await api.program.calculateGas.handle(
                    account.decodedAddress,
                    MAIN_CONTRACT.PROGRAM_ID,
                    message.payload,
                    0,
                    false,
                    mainContractMetadata
                );
                message.gasLimit = Number(gasToSpend(gas));
            } catch (e) {
                console.warn("Failed to calculate gas, using default:", e);
            }
    
            const { signer } = await web3FromSource(account.meta.source);
            const throwCardExtrinsic = api.message.send(message, mainContractMetadata);
    
            return new Promise((resolve, reject) => {
                throwCardExtrinsic
                    .signAndSend(account.decodedAddress, { signer }, ({ status }) => {
                        if (status.isInBlock) {
                            console.log(`Completed at block hash #${status.asInBlock.toString()}`);
                            resolve(true);
                        } else {
                            console.log(`Current status: ${status.type}`);
                        }
                    })
                    .catch(reject);
            });
        } catch (error) {
            console.error("Error sending play card transaction:", error);
            throw error;
        }
    }, [api, account, mainContractMetadata]);

    // Update game state with selected card
    const updateGameWithSelectedCard = useCallback(async (matchId: number) => {
        if (!api || matchId === -1) return;

        try {
            const response = await api.programState.read({
                programId: MAIN_CONTRACT.PROGRAM_ID,
                payload: { GameInformationById: matchId }
            }, mainContractMetadata);
            
            const formattedState: any = response.toJSON();
            const { chosenNft: tokenId } = formattedState.gameInformation.user1;

            if (tokensForOwnerState.length === 0) {
                console.warn("No NFT tokens available for owner");
                return;
            }

            const selectedNft = tokensForOwnerState.find((nft: any) => nft[0] === tokenId);
            if (!selectedNft) {
                console.warn("Selected NFT not found in owner state");
                return;
            }

            setCardToPlay(selectedNft);
            setTokensForOwnerState(prev => prev.filter((nft: any) => nft[0] !== tokenId));
            setMatchInProgress(true);
        } catch (error) {
            console.error("Error updating game with selected card:", error);
        }
    }, [api, mainContractMetadata, tokensForOwnerState]);

    // Display match results
    const showMatchResults = useCallback((currentUserAddress: `0x${string}`, matchData: any) => {
        const { matchState, user1, user2 } = matchData;
        const opponentData = user1.userId === currentUserAddress ? user2 : user1;
        
        setEnemyCard(opponentData.nftData);
        setEnemyCardCount(opponentData.nftCount);

        const isDraw = Object.keys(matchState)[0] === "draw";
        const isWinner = !isDraw && matchState.finished.winner === currentUserAddress;
        setUserWonTheMatch(isDraw ? null : isWinner);
    }, []);

    // Wait for match completion
    const userWaitingMatch = useCallback(async (matchId: number) => {
        if (!api || !account) return;

        let matchFinished = false;
        while (!matchFinished) {
            const stateResult = await api.programState.read({
                programId: MAIN_CONTRACT.PROGRAM_ID,
                payload: { MatchStateById: matchId }
            }, mainContractMetadata);

            const stateFormatted: any = stateResult.toJSON();
            if (stateFormatted.matchDoesNotExists) {
                console.log("Match no longer exists");
                break;
            }

            const matchState = Object.keys(stateFormatted.matchState)[0];
            if (matchState !== 'inProgress') {
                matchFinished = true;
            }

            // Get round information to update game state
            const roundInfo = await getRoundInformation(matchId);
            if (roundInfo) {
                // Update game state based on round information
                const isPlayerTurn = roundInfo.currentPlayer === account.decodedAddress;
                if (!isPlayerTurn && roundInfo.lastPlayedCard) {
                    setEnemyCard(roundInfo.lastPlayedCard);
                }
            }

            // Prevent tight polling
            await sleepReact(1000);
        }

        // Get final match state
        const matchInfoResult = await api.programState.read({
            programId: MAIN_CONTRACT.PROGRAM_ID,
            payload: { GameInformationById: matchId }
        }, mainContractMetadata);

        const matchInfo: any = matchInfoResult.toJSON();
        showMatchResults(account.decodedAddress, matchInfo.gameInformation);
        setMatchInProgress(false);

        // Wait for UI update
        await sleepReact(4000);

        // Double check match state
        const finalStateResult = await api.programState.read({
            programId: MAIN_CONTRACT.PROGRAM_ID,
            payload: { MatchStateById: matchId }
        }, mainContractMetadata);
        
        const finalState: any = finalStateResult.toJSON();
        const finalMatchState = Object.keys(finalState.matchState)[0];

        if (finalMatchState === 'inProgress') {
            alert.error("Contract error, searching for match");
            await userWaitingMatch(matchId);
            return;
        }

        resetBoard();
    }, [api, account, mainContractMetadata, getRoundInformation, showMatchResults, resetBoard, alert]);
    
// Handle play button press
const handlePlayButton = useCallback(async () => {
    if (!api || !account) return;

    try {
        const matchId = await getCurrentUserMatch();
        setUserPressPlayButton(true);
        console.log(`Match ID: ${matchId}`);

        if (matchId !== -1) {
            console.log(`Found Match ID: ${matchId}`);
            setUserInMatch(true);
            setMatchInProgress(true);
            await getMatchDetails(matchId);
            await userWaitingMatch(matchId);
            return;
        }

        const selectedCardIds = selectedCards.map((card: any) => Number(card[0]));
        
        // Send join game transaction
        await sendJoinGameTransaction(selectedCardIds);
        
        setUserInMatch(true);
        
        // Poll for match ID
        const pollForMatch = async () => {
            const newMatchId = await getCurrentUserMatch();
            if (newMatchId !== -1) {
                await getMatchDetails(newMatchId);
                await userWaitingMatch(newMatchId);
            } else {
                await sleepReact(1000);
                await pollForMatch();
            }
        };

        await pollForMatch();

    } catch (error) {
        console.error("Error handling play button:", error);
        alert.error("Failed to start game. Please try again.");
        resetBoard();
    }
}, [api, account, selectedCards, getCurrentUserMatch, getMatchDetails, 
    userWaitingMatch, sendJoinGameTransaction, resetBoard, alert]);

    // Add card to play
    const addCardToPlay = useCallback(async (card: any) => {
        if (userInMatch) return;

        try {
            if (currentMatchId !== null) {
                await sendPlayCardTransaction(Number(card[0]));
            }

            setSelectedCards(prev => {
                const updatedCards = prev.filter((actualCard: any) => actualCard[0] !== card[0]);
                if (cardToPlay) updatedCards.push(cardToPlay);
                return updatedCards;
            });
            setCardToPlay(card);
        } catch (error) {
            console.error("Error adding card to play:", error);
            alert.error("Failed to play card. Please try again.");
        }
    }, [userInMatch, cardToPlay, currentMatchId, sendPlayCardTransaction, alert]);

    // Remove card from play
    const removeCardToPlay = useCallback((card: any) => {
        if (userInMatch || matchInProgress) return;
        setSelectedCards(prev => [card, ...prev]);
        setCardToPlay(null);
    }, [userInMatch, matchInProgress]);

    // Handle card selection
    const cardSelected = useCallback((tokenId: any, selected: boolean) => {
        dispatch(addCard(tokenId));

        if (!selected) {
            const nftSelected = tokensForOwnerState.find((token: any) => token[0] === tokenId);
            setSelectedCards(prev => {
                const newSelected = [nftSelected, ...prev];
                if (newSelected.length > 3) {
                    const overflow = newSelected.pop();
                    setTokensForOwnerState(prev => [overflow, ...prev]);
                }
                return newSelected;
            });
            setTokensForOwnerState(prev => prev.filter((token: any) => token[0] !== tokenId));
        } else {
            const nftSelected = selectedCards.find((token: any) => token[0] === tokenId);
            setSelectedCards(prev => prev.filter((token: any) => token[0] !== tokenId));
            setTokensForOwnerState(prev => [nftSelected, ...prev]);
        }
    }, [tokensForOwnerState, selectedCards, dispatch]);

    // Initialize data
    const setData = useCallback(async () => {
        if (!api || !account) return;

        if (actualUserInMatch !== account.decodedAddress) {
            console.log("Resetting the board!");
            resetBoard();
        }

        if (!nftsLoaded) {
            console.log("Loading NFTs");
            const resultNfts = await api.programState.read({
                programId: NFT_CONTRACT.PROGRAM_ID,
                payload: { tokensForOwner: account.decodedAddress }
            }, nftContractMetadata);

            const nftStateFormatted: any = resultNfts.toJSON();
            const tokensForOwner: [any] = nftStateFormatted.tokensForOwner ?? [];
            setStateWithoutSelectedCards(tokensForOwner, selectedCards);
            setNftsLoaded(true);
        }

        if (!userInMatch) {
            const matchId = await getCurrentUserMatch();
            setActualUserInMatch(account.decodedAddress);
            
            if (matchId !== -1) {
                await getMatchDetails(matchId);
                await updateGameWithSelectedCard(matchId);
                setUserInMatch(true);
                setMatchInProgress(true);
                setUserPressPlayButton(true);
                await userWaitingMatch(matchId);
            }
        }
    }, [api, account, actualUserInMatch, nftsLoaded, userInMatch, selectedCards, getCurrentUserMatch, 
        getMatchDetails, updateGameWithSelectedCard, userWaitingMatch, resetBoard, setStateWithoutSelectedCards]);

    // Initialize on account/API change
    useEffect(() => {
        if (account && api) {
            setData();
        }
    }, [account, api, setData]);

    return {
        // State values
        userPressPlayButton,
        tokensForOwnerState,
        selectedCards,
        cardToPlay,
        nftsLoaded,
        userInMatch,
        matchInProgress,
        setMatchInProgress,
        setEnemyCard,
        setUserInMatch,
        actualUserInMatch,
        enemyCard,
        enemyCardCount,
        userWonTheMatch,
        enemyName,
        
        // Actions
        handlePlayButton,
        cardSelected,
        addCardToPlay,
        removeCardToPlay,
        resetBoard,
        setUserWonTheMatch,
        getCurrentUserMatch,
        sendPlayCardTransaction
    };
}

export default useGameState;