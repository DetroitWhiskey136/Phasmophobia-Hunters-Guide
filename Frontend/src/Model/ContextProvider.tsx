import { AxiosResponse } from "axios";
import React, { ReactNode, useEffect } from "react";
import { AppState } from "./AppState";
import Evidence from "./Evidence";
import Objective from "./Objective";
import { bool3, PG_ADDR } from "../index"
import { GameContext } from "./GameContext";
import ObjectiveState from "./ObjectiveState";
import { useToast } from "@chakra-ui/react";
const axios = require("axios").default;

type ContextProviderModel = {
    children: ReactNode
}

export const ContextProvider = ({children}: ContextProviderModel) => {

    const toast = useToast()

    const [gameState, setGameState] = React.useState(new AppState())

    let ghostNameIsDirty = false

    const setGhostName = (name: string) => {
        ghostNameIsDirty = true
        setGameState({...gameState, ghostName: name})
    }

    const postGhostName = async () => {
        console.log("posting")
        axios.post(`${PG_ADDR}/api/game/update`, {
            uuid: gameState.uuid,
            action: "name",
            name: gameState.ghostName,
        })
    }

    const setAloneGhost = async (isAloneGhost: bool3) => {
        try {
            setGameState({...gameState, aloneGhost: isAloneGhost})
            return await axios.post(`${PG_ADDR}/api/game/update`, {
                uuid: gameState.uuid,
                action: "aloneghost",
                aloneghost: isAloneGhost,
            })
        } catch (error) {
            return `error: ${error}`
        }
    }

    const setObjective = async (objective: Objective, state: ObjectiveState) => {
        let objectives = gameState.objectives
        objectives.set(objective, state)
        setGameState({...gameState, objectives: objectives})
        try {
            return await axios.post(`${PG_ADDR}/api/game/update`, {
                uuid: gameState.uuid,
                action: "objective",
                objective: objective.rowName,
                state: state,
            })
        } catch (error) {
            return `error: ${error}`
        }
    }

    const setEvidence = async (evidence: Evidence, evidenceState: bool3) => {
        let evidences = gameState.evidences
        evidences.set(evidence, evidenceState)
        setGameState({...gameState, evidences: evidences})
        try {
            await axios.post(`${PG_ADDR}/api/game/update`, {
                uuid: gameState.uuid,
                action: "evidence",
                evidence: evidence.rowName,
                state: evidenceState,
            }).then((response: AxiosResponse) => {
                console.log(response)
            })
        } catch(error) {
            console.log("POST error: " + error)
        }
    }

    const update = async () => {
        const parsePostgresState = (state: boolean | string | null) => {
            switch (state) {
                case true: case "yes": return true
                case false: case "no": return false
                case null: case undefined: case "unknown": return undefined
            }
        }
        const parseObjective = (objective: string): ObjectiveState => {
            switch (objective) {
                case "yes": return ObjectiveState.yes
                case "no": return ObjectiveState.no
                case "started": return ObjectiveState.started
                case "irrelevant": return ObjectiveState.irrelevant
            }
            return ObjectiveState.irrelevant
        }
        try {
            let res = await axios.get(`${PG_ADDR}/api/game/${gameState.uuid}`)
            let newState = new AppState()
            newState.uuid = res.data.uuid
            newState.isLoading = false
            newState.aloneGhost = res.data.alone_ghost
            newState.ghostName = (!res.data.ghost_name) ? "" : res.data.ghost_name
            console.log("updating: is ghost name dirty?")
            if (ghostNameIsDirty) {
                console.log("yes")
                postGhostName()
                newState.ghostName = gameState.ghostName
                ghostNameIsDirty = false
            }

            newState.evidences = new Map<Evidence, bool3>()
            newState.evidences.set(Evidence.fingerprints, parsePostgresState(res.data.fingerprints))
            newState.evidences.set(Evidence.freezing, parsePostgresState(res.data.freezing))
            newState.evidences.set(Evidence.emf5, parsePostgresState(res.data.emf5))
            newState.evidences.set(Evidence.orbs, parsePostgresState(res.data.orbs))
            newState.evidences.set(Evidence.spiritBox, parsePostgresState(res.data.spirit_box))
            newState.evidences.set(Evidence.ghostWriting, parsePostgresState(res.data.ghost_writing))

            newState.objectives = new Map<Objective, ObjectiveState>()
            newState.objectives.set(Objective.main, parseObjective(res.data.obj_main))
            newState.objectives.set(Objective.ghostEvent, parseObjective(res.data.obj_ghostevent))
            newState.objectives.set(Objective.ghostPhoto, parseObjective(res.data.obj_ghostphoto))
            newState.objectives.set(Objective.dirtyWater, parseObjective(res.data.obj_dirtywater))
            newState.objectives.set(Objective.emf, parseObjective(res.data.obj_emf))
            newState.objectives.set(Objective.coldRoom, parseObjective(res.data.obj_coldroom))
            newState.objectives.set(Objective.motionSensor, parseObjective(res.data.obj_motionsensor))
            newState.objectives.set(Objective.smudgeSticks, parseObjective(res.data.obj_smudgesticks))
            newState.objectives.set(Objective.crucifix, parseObjective(res.data.obj_crucifix))
            newState.objectives.set(Objective.salt, parseObjective(res.data.obj_salt))

            if (!gameState.isLoading) {
                if (gameState.aloneGhost !== newState.aloneGhost) {
                    toast({
                        title: "Update",
                        description: "Ghost shyness is now " + newState.aloneGhost,
                        status: "success",
                        duration: 5000,
                        isClosable: true,
                    })
                }
            }

            if (gameState.isDiff(newState)) {
                setGameState(newState)
            }
        } catch(error) {
            console.log("UPDATE ERROR: " + error)
        }
    }

    useEffect(() => {
        const updater = setInterval(update, 2500)
        return () => clearInterval(updater)
    })

    return (
        <GameContext.Provider value={{gameState, setEvidence, setObjective, setGhostName, setAloneGhost}}>
            {children}
        </GameContext.Provider>
    )
}
