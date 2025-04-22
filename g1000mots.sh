#!/bin/bash

# Définir AU MINIMUM la variable d'environnement "TSV_DIR" :
#   elle doit pointer vers un dossier contenant UNIQUEMENT les fichiers .tsv des transcriptions des vidéos, avec un titre de la forme :
#   "xxxx.titre de la vidéo.ididididididi.tsv" où :
#        - "xxxx" est un numéro, entre 0000 et 9999 servant à ordonner les transcriptions lors d'une recherche ;
#        - "titre de la vidéo" est le titre de la vidéo transcrite (note : lors de l'affichage, les caractères "trop spéciaux" seront omis) ;
#        - "ididididididi" est l'ID de la vidéo YouTube dont est tirée la transcription, utilisé pour les liens.
#
# Définir "DISCORD_ENABLE" à "true", ainsi que "DISCORD_TOKEN" et "DISCORD_CHANNEL_ID" pour activer l'envoi de messages sur un salon Discord.
#   Si "DISCORD_ENABLE" n'est pas défini ou est défini à "false", le script passe en mode débogage et affiche tout sur la console, dont des informations supplémentaires pour aider au débogage.

DISCORD_ENABLE="${DISCORD_ENABLE:-false}"
SEARCH_MIN_CHARS="${SEARCH_MIN_CHARS:-4}"
SEARCH_MAX_CHARS="${SEARCH_MAX_CHARS:-100}"
MAX_MATCHES="${MAX_MATCHES:-100}"
DISCORD_MAX_MESSAGE_SIZE="${DISCORD_MAX_MESSAGE_SIZE:-1900}"
DISCORD_SENDING_COOLDOWN="${DISCORD_SENDING_COOLDOWN:-0.5}"
LOG_FILE="${LOG_FILE:-/dev/null}"

if [ -z "${TSV_DIR}" ]; then
    printf -- 'TSV_DIR environment variable is not defined, aborting\n'
    exit '2'
else
    [[ "${TSV_DIR}" != */ ]] && TSV_DIR="${TSV_DIR}"'/'
    if [ ! -d "${TSV_DIR}" ]; then
        printf -- 'Directory "%s" does not exist, aborting\n' "${TSV_DIR}"
        exit '3'
    fi
fi
if "${DISCORD_ENABLE}"; then
    if [ -z "${DISCORD_TOKEN}" ]; then
        printf -- 'DISCORD_TOKEN environment variable is not defined, aborting\n'
        exit '4'
    elif [ -z "${DISCORD_CHANNEL_ID}" ]; then
        printf -- 'DISCORD_CHANNEL_ID environment variable is not defined, aborting\n'
        exit '5'
    fi
fi

backticks_remover() {
    sed -- 's/`//g' <<< "${1}"
}

keep_alnum_only() {
    sed -- 's/＊/$/g; s/[^a-zA-Z0-9ÀàÂâÇçÉéÈèÊêËëÎîÏïijÔôÙùÛûÜü .,?!;%$()«»@+"&:'"'"'-]*//g; s/  +/ /g; s/^[ ]*//; s/[ ]*$//' <<< "${1}"
}

show_footer() {
    printf -- '-# *\*cette recherche étant effectuée sur des transcriptions réalisées avec [Whisper](<https://github.com/openai/whisper>), les résultats sont susceptibles de contenir des erreurs !*\n'
}

send_message_to_discord() {
    local message
    message="$(jq -n --arg content "${1}" '{"content": $content}')"
    if "${DISCORD_ENABLE}"; then
        if ! timeout -- '3' curl \
          -s \
          -d "${message}" \
          -H 'Authorization: Bot '"${DISCORD_TOKEN}" \
          -H "Content-Type: application/json" \
          -X 'POST' \
          'https://discordapp.com/api/channels/'"${DISCORD_CHANNEL_ID}"'/messages'; then
            return '2'
        fi
        sleep -- "${DISCORD_SENDING_COOLDOWN}"
    else
        printf -- '%s' "${1}"
        printf -- '\n--- Message size : %d characters ---\n' "${#1}"
        sleep -- "${DISCORD_SENDING_COOLDOWN}"
    fi

}

### ATTENTION : FONCTION "split_text_into_chunks" GÉNÉRÉE PARTIELLEMENT PAR MISTRAL AI
split_text_into_chunks() {
    local all_text="$1"
    local IFS=$'\n'
    mapfile -t -- 'lines_array' < <(printf -- "${all_text}")
    local chunks=()
    local current_chunk=()
    local current_length='0'

    for line in "${lines_array[@]}"; do
        if [ "$((current_length+${#line}+1))" -gt "${DISCORD_MAX_MESSAGE_SIZE}" ]; then
            chunks+=("$(printf -- '%s\n' "${current_chunk[*]}")")
            current_chunk=()
            current_length='0'
        fi

        current_chunk+=("${line}")
        ((current_length += ${#line} + 1))  # +1 for the newline character
    done

     if [ ${#current_chunk[@]} -ne '0' ]; then
        chunks+=("$(printf -- '%s\n' "${current_chunk[*]}")")
    fi

    local total_chunks="${#chunks[@]}"
    local chunk_index='1'

    for chunk in "${chunks[@]}"; do
        send_message_to_discord "$(printf -- '%s\n-# [%d/%d]' "${chunk}" "${chunk_index}" "${total_chunks}")"
        ((chunk_index++))
    done
}

entire_text=''
main() {
    search="$(backticks_remover "${1}")"

    if ! "${DISCORD_ENABLE}"; then
        printf -- 'Debug variables:\n'
        printf -- '  TSV_DIR\t\t\t= "%s"\n' "${TSV_DIR}"
        printf -- '  DISCORD_ENABLE\t\t= "%s"\n' "${DISCORD_ENABLE}"
        printf -- '  DISCORD_CHANNEL_ID\t\t= "%s"\n' "${DISCORD_CHANNEL_ID}"
        printf -- '  DISCORD_TOKEN\t\t\t= "%s"\n' "${DISCORD_TOKEN}"
        printf -- '  -----\n'
        printf -- '  SEARCH_MIN_CHARS\t\t= "%s"\n' "${SEARCH_MIN_CHARS}"
        printf -- '  SEARCH_MAX_CHARS\t\t= "%s"\n' "${SEARCH_MAX_CHARS}"
        printf -- '  MAX_MATCHES\t\t\t= "%s"\n' "${MAX_MATCHES}"
        printf -- '  DISCORD_MAX_MESSAGE_SIZE\t= "%s"\n' "${DISCORD_MAX_MESSAGE_SIZE}"
        printf -- '  DISCORD_SENDING_COOLDOWN\t= "%s"\n' "${DISCORD_SENDING_COOLDOWN}"
        printf -- '  LOG_FILE\t\t\t= "%s"\n' "${LOG_FILE}"
        printf -- '  -----\n'
        printf -- '  search\t\t\t= "%s"\n' "${search}"
        printf -- '\n\n'
    fi


    if [ "${#search}" -lt "${SEARCH_MIN_CHARS}" ]; then
        entire_text='## Pas assez de caractères pour lancer une recherche, merci d'"'"'en taper au moins '"${SEARCH_MIN_CHARS}"
        return '1'
    elif [ "${#search}" -gt "${SEARCH_MAX_CHARS}" ]; then
        entire_text='## Trop de caractères pour lancer une recherche, merci d'"'"'en taper au maximum '"${SEARCH_MAX_CHARS}"
        return '1'
    fi

    all_lines="$(grep -FHir -- "${search}" "${TSV_DIR}" | sed -- 's%'"${TSV_DIR}"'%%' | sort -k '1' -n -s -t '.' -- | sed -- 's/^$//')"
    total_occurences_nb="$(wc -l <<< "${all_lines}")"
    
    if [ -z "${all_lines}" ]; then # "wc -l" returns 1 even if "${all_lines}" is empty (instead of 0)
        entire_text="$(printf -- '## Le terme `%s` semble\* n'"'"'avoir jamais été prononcé dans une vidéo de G\n' "${search}")"
        entire_text="${entire_text}\n$(show_footer)"
        return '1'
    elif [ "${total_occurences_nb}" -eq '1' ]; then
        entire_text="$(printf -- '## Le terme `%s` semble\* avoir été prononcé %s fois dans la vidéo suivante :\n' "${search}" "${total_occurences_nb}")"
    else
        entire_text="$(printf -- '## Le terme `%s` semble\* avoir été prononcé %s fois au total dans les vidéos suivantes :\n' "${search}" "${total_occurences_nb}")"
    fi

    last_video=''
    occurences_per_video='0'
    while IFS= read -r -- 'line'; do
        line_without_number="$(awk -F '.tsv:' -- '{print $1}' <<< "${line}" | cut -c '6-' --)"
        video_id="${line_without_number: -11}"
        video_name="$(keep_alnum_only "$(basename "${line_without_number}" '.'"${video_id}")")"
        video_url='https://www.youtube.com/watch?v='"${video_id}"

        if [ "${last_video}" != "${video_id}" ]; then
            if [ "${total_occurences_nb}" -gt "${MAX_MATCHES}" ]; then
                if [ "${occurences_per_video}" -eq '1' ]; then
                    entire_text="${entire_text} *<${occurences_per_video} occurence>*"
                elif [ "${occurences_per_video}" -ge '2' ]; then
                    entire_text="${entire_text} *<${occurences_per_video} occurences>*"
                fi
                occurences_per_video='1'
            fi
            last_video="${video_id}"
            entire_text="${entire_text}\n$(printf -- '- [%s](%s)\n' "${video_name}" '<'"${video_url}"'>')"
        else
            ((occurences_per_video++))
        fi

        if [ "${total_occurences_nb}" -le "${MAX_MATCHES}" ]; then
            timestamps_and_text="$(awk -F '.tsv:' -- '{print $2}' <<< "${line}")"
            timestamp_start="$(("$(awk -F '\t' -- '{print $1}' <<< "${timestamps_and_text}")"/1000))"
            #timestamp_end="$(awk -F '\t' -- '{print $2}' <<< "${timestamps_and_text}" | sed -- 's/...$//')" # Pas d'utilité pour le moment... mais vu que ça dérange pas, ça peut rester ici si besoin un jour !
            ts_to_h="$(printf -- '%02d' "$((timestamp_start/3600))")"
            ts_to_m="$(printf -- '%02d' "$((timestamp_start/60%60))")"
            ts_to_s="$(printf -- '%02d' "$((timestamp_start%60))")"
            text="$(backticks_remover "$(awk -F '\t' -- '{for (i=3; i<=NF; i++) print $i}' <<< "${timestamps_and_text}")")"

            entire_text="${entire_text}\n$(printf -- '  - [%s:%s:%s](%s) : `%s`\n' "${ts_to_h}" "${ts_to_m}" "${ts_to_s}" '<'"${video_url}"'&t='"${timestamp_start}"'>' "${text}")"
        fi
    done <<< "${all_lines}"

    # Oui oui, "Beurk c'est laid ce doublon", mais j'ai pas d'autre solution pour afficher le nombre d'occurences de la dernière vidéo pour le moment...
    if [ "${total_occurences_nb}" -gt "${MAX_MATCHES}" ]; then
        if [ "${occurences_per_video}" -eq '1' ]; then
            entire_text="${entire_text} <${occurences_per_video} occurence>"
        elif [ "${occurences_per_video}" -ge '2' ]; then
            entire_text="${entire_text} <${occurences_per_video} occurences>"
        fi
    fi


    if [ "${total_occurences_nb}" -gt "${MAX_MATCHES}" ]; then
        entire_text="${entire_text}\n$(printf -- '### Trop de résultats pour afficher le détail des occurences\n')"
    fi
    entire_text="${entire_text}\n$(show_footer)"
}

main "${*}"
split_text_into_chunks "${entire_text}"