import { useCallback, useState } from 'react';
import { MAIN_CONTRACT, NFT_CONTRACT } from "@/app/consts";
import { ProgramMetadata } from "@gear-js/api";
import { useAccount, useApi } from "@gear-js/react-hooks";
import { CardProps } from '@/interfaces/Card';

const useCardsData = () => {
    const { api } = useApi();
    const { account } = useAccount();

    const mainContractMetadata = ProgramMetadata.from(MAIN_CONTRACT.METADATA);
    const nftContractMetadata = ProgramMetadata.from(NFT_CONTRACT.METADATA);

    const [allUserCards, setAllUserCards] = useState<CardProps[]>([]);
    const [playingUserCards, setPlayingUserCards] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getMatchId = useCallback(async (): Promise<number> => {
        if (!api || !account) return -1;

        try {
            const response = await api.programState.read({
                programId: MAIN_CONTRACT.PROGRAM_ID,
                payload: { PlayerIsInMatch: account.decodedAddress }
            }, mainContractMetadata);

            const { playerInMatch }: any = response.toJSON();
            return playerInMatch ?? -1;
        } catch (error) {
            console.error("Error getting match ID:", error);
            setError("Failed to get match ID");
            return -1;
        }
    }, [api, account, mainContractMetadata]);

    const fetchData = useCallback(async () => {
        if (!account || !api) return;
        setIsLoading(true);
        setError(null);

        try {
            const response = await api.programState.read({
                programId: NFT_CONTRACT.PROGRAM_ID,
                payload: { tokensForOwner: account.decodedAddress }
            }, nftContractMetadata);

            const formattedResponse: any = response.toJSON();
            setAllUserCards(formattedResponse.tokensForOwner ?? []);
        } catch (error) {
            console.error("Error fetching user cards:", error);
            setError("Failed to fetch cards");
        } finally {
            setIsLoading(false);
        }
    }, [api, account, nftContractMetadata]);

    const getPlayingCards = useCallback(async () => {
        if (!account || !api) return;
        
        try {
            const matchId = await getMatchId();
            if (matchId === -1) return;

            const response = await api.programState.read({
                programId: MAIN_CONTRACT.PROGRAM_ID,
                payload: { GameInformationById: matchId }
            }, mainContractMetadata);

            const formattedResponse: any = response.toJSON();
            const { gameInformation } = formattedResponse;

            if (gameInformation?.user1?.chosenNft) {
                setPlayingUserCards(gameInformation.user1.chosenNft);
            }
        } catch (error) {
            console.error("Error getting playing cards:", error);
            setError("Failed to get playing cards");
        }
    }, [api, account, mainContractMetadata, getMatchId]);

    return { 
        allUserCards, 
        fetchData, 
        getPlayingCards, 
        playingUserCards,
        isLoading,
        error 
    };
};

export default useCardsData;