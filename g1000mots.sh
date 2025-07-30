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
MAX_MATCHES_LIMIT="${MAX_MATCHES_LIMIT:-1000}"
DISCORD_MAX_MESSAGE_SIZE="${DISCORD_MAX_MESSAGE_SIZE:-1900}"
DISCORD_SENDING_COOLDOWN="${DISCORD_SENDING_COOLDOWN:-0.25}"
DISCORD_MAX_MESSAGE_SENDING_RETRIES="${DISCORD_MAX_MESSAGE_SENDING_RETRIES:-2}"
LOG_FILE="${LOG_FILE:-/dev/tty}"
TSV_EXTENSION="${TSV_EXTENSION:-.tsv}"
BULLET_POINT_SYMBOL="${BULLET_POINT_SYMBOL:-:large_blue_diamond:}"
SUB_BULLET_POINT_SYMBOL="${SUB_BULLET_POINT_SYMBOL:-:small_orange_diamond:}"

logs_date_severity() {
    local severity
    case "${1}" in
        C)
            severity='CRT'
            ;;
        E)
            severity='ERR'
            ;;
        W)
            severity='WRN'
            ;;
        I)
            severity='INF'
            ;;
        D)
            severity='DBG'
            ;;
        *)
            severity='UNK'
            ;;
    esac
    printf -- '[%s]\t%s\t' "$(date -- '+%Y-%m-%d %H:%M:%S')" "${severity}"
    return '0'
}

backticks_remover() {
    sed -- 's/`//g' <<< "${1}"
}

keep_alnum_only() {
    sed -- 's/＊/$/g; s/[^a-zA-Z0-9ÀàÂâÇçÉéÈèÊêËëÎîÏïijÔôÙùÛûÜü .,?!;%$()«»@+"&:'"'"'-]*//g; s/  +/ /g; s/^[ ]*//; s/[ ]*$//' <<< "${1}"
}

show_footer() {
    printf -- '-# *\*cette recherche étant effectuée sur des transcriptions réalisées avec [Whisper](<https://github.com/openai/whisper>), les résultats sont susceptibles de contenir des erreurs !*'
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
            printf -- '%sFailed to send curl request in time\n' "$(logs_date_severity 'E')" >> "${LOG_FILE}"
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
    local all_text=("${@}")
    local IFS=$'\n'
    local chunks=()
    local current_chunk=()
    local current_length='0'

    for line in "${all_text[@]}"; do
        if [ "$((current_length+"${#line}"+11+1))" -gt "${DISCORD_MAX_MESSAGE_SIZE}" ]; then
            chunks+=("${current_chunk[*]}")
            current_chunk=()
            current_length='0'
        fi

        current_chunk+=("${line}")
        ((current_length+="${#line}"+11+1))  # +1 for the newline character // +11 for the "[x/x]" part
    done

     if [ ${#current_chunk[@]} -ne '0' ]; then
        chunks+=("${current_chunk[*]}")
    fi

    local total_chunks="${#chunks[@]}"
    local chunk_index='1'

    for chunk in "${chunks[@]}"; do
        if "${DISCORD_ENABLE}"; then
            for((retry_count=0;retry_count<"$((DISCORD_MAX_MESSAGE_SENDING_RETRIES+1))";retry_count++)); do # +1 for the initial attempt
                curl_discord_answer="$(send_message_to_discord "$(printf -- '_ _\n%s\n-# [%d/%d]' "${chunk}" "${chunk_index}" "${total_chunks}")")"
                retry_time="$(jq '.retry_after // empty' <<< "${curl_discord_answer}")"
                if [ "${retry_time}" == '' ]; then
                    break -- '1'
                else
                    printf -- '%sRate limited by Discord, waiting for "%s"s\n' "$(logs_date_severity 'I')" "${retry_time}" >> "${LOG_FILE}"
                    sleep -- "${retry_time}"
                fi
            done
        else
            send_message_to_discord "$(printf -- '_ _\n%s\n-# [%d/%d]' "${chunk}" "${chunk_index}" "${total_chunks}")"
        fi
        ((chunk_index++))
    done
}

entire_text=()
main() {
    search="$(backticks_remover "${1}")"

    if ! "${DISCORD_ENABLE}"; then
        printf -- 'Debug variables:\n'
        printf -- '  TSV_DIR\t\t\t\t= "%s"\n' "${TSV_DIR}"
        printf -- '  DISCORD_ENABLE\t\t\t= "%s"\n' "${DISCORD_ENABLE}"
        printf -- '  DISCORD_CHANNEL_ID\t\t\t= "%s"\n' "${DISCORD_CHANNEL_ID}"
        printf -- '  DISCORD_TOKEN\t\t\t\t= "%s"\n' "${DISCORD_TOKEN}"
        printf -- '  -----\n'
        printf -- '  SEARCH_MIN_CHARS\t\t\t= "%s"\n' "${SEARCH_MIN_CHARS}"
        printf -- '  SEARCH_MAX_CHARS\t\t\t= "%s"\n' "${SEARCH_MAX_CHARS}"
        printf -- '  MAX_MATCHES\t\t\t\t= "%s"\n' "${MAX_MATCHES}"
        printf -- '  MAX_MATCHES_LIMIT\t\t\t= "%s"\n' "${MAX_MATCHES_LIMIT}"
        printf -- '  DISCORD_MAX_MESSAGE_SIZE\t\t= "%s"\n' "${DISCORD_MAX_MESSAGE_SIZE}"
        printf -- '  DISCORD_SENDING_COOLDOWN\t\t= "%s"\n' "${DISCORD_SENDING_COOLDOWN}"
        printf -- '  DISCORD_MAX_MESSAGE_SENDING_RETRIES\t= "%s"\n' "${DISCORD_MAX_MESSAGE_SENDING_RETRIES}"
        printf -- '  LOG_FILE\t\t\t\t= "%s"\n' "${LOG_FILE}"
        printf -- '  TSV_EXTENSION\t\t\t\t= "%s"\n' "${TSV_EXTENSION}"
        printf -- '  BULLET_POINT_SYMBOL\t\t\t= "%s"\n' "${BULLET_POINT_SYMBOL}"
        printf -- '  SUB_BULLET_POINT_SYMBOL\t\t= "%s"\n' "${SUB_BULLET_POINT_SYMBOL}"
        printf -- '  -----\n'
        printf -- '  search\t\t\t\t= "%s"\n' "${search}"
        printf -- '  search (# of chars)\t\t\t= "%s"\n' "${#search}"
        printf -- '\n\n'
    fi


    if [ "${#search}" -lt "${SEARCH_MIN_CHARS}" ]; then
        entire_text+=('## Pas assez de caractères pour lancer une recherche, merci d'"'"'en taper au minimum '"${SEARCH_MIN_CHARS}")
        return '1'
    elif [ "${#search}" -gt "${SEARCH_MAX_CHARS}" ]; then
        entire_text+=('## Trop de caractères pour lancer une recherche, merci d'"'"'en taper au maximum '"${SEARCH_MAX_CHARS}")
        return '1'
    fi

    all_grepped_lines="$(grep -FHr"${GREP_ARGS}" --include '*'"${TSV_EXTENSION}" -- "${search}" "${TSV_DIR}" | sed -- 's%'"${TSV_DIR}"'%%' | sort -k '1' -n -s -t '.' --)"
    number_of_different_files="$(grep -Flr"${GREP_ARGS}" --include '*'"${TSV_EXTENSION}" -- "${search}" "${TSV_DIR}" | wc -l --)"
    total_occurences_nb="$(wc -l <<< "${all_grepped_lines}")"

    entire_text+=('__*mode de recherche : **'"${GREP_MODE}"'***__')
    if [ "${number_of_different_files}" -eq '0' ]; then
        entire_text+=('## Le terme `'"${search}"'` semble\* n'"'"'avoir jamais été prononcé dans une vidéo')
        entire_text+=("$(show_footer)")
        return '1'
    elif [ "${total_occurences_nb}" -gt "${MAX_MATCHES_LIMIT}" ]; then
        entire_text+=('## Beaucoup trop de résultats\* pour le terme `'"${search}"'` ('"${total_occurences_nb}"' occurences dans '"${number_of_different_files}"' vidéos), merci de faire une recherche moins générique')
        entire_text+=("$(show_footer)")
        return '1'
    elif [ "${number_of_different_files}" -eq '1' ]; then
        entire_text+=('## Le terme `'"${search}"'` semble\* avoir été prononcé '"${total_occurences_nb}"' fois dans la vidéo suivante :')
    else
        entire_text+=('## Le terme `'"${search}"'` semble\* avoir été prononcé '"${total_occurences_nb}"' fois au total dans les '"${number_of_different_files}"' vidéos suivantes :')
    fi

    last_video=''
    occurences_per_video='0'
    while IFS= read -r -- 'line'; do
        line_without_number="$(awk -F "${TSV_EXTENSION}"':' -- '{print $1}' <<< "${line}" | cut -c '6-' --)"
        video_id="${line_without_number: -11}"
        video_name="$(keep_alnum_only "$(basename "${line_without_number}" '.'"${video_id}")")"
        video_url='https://www.youtube.com/watch?v='"${video_id}"

        if [ "${last_video}" != "${video_id}" ]; then
            if [ "${total_occurences_nb}" -gt "${MAX_MATCHES}" ]; then
                last_element=$(("${#entire_text[@]}"-1))
                if [ "${occurences_per_video}" -eq '1' ]; then
                    entire_text["${last_element}"]+=' *<'"${occurences_per_video}"' occurence>*'
                elif [ "${occurences_per_video}" -ge '2' ]; then
                    entire_text["${last_element}"]+=' *<'"${occurences_per_video}"' occurences>*'
                fi
                occurences_per_video='1'
            fi
            last_video="${video_id}"
            entire_text+=("${BULLET_POINT_SYMBOL}"' ['"${video_name}"'](<'"${video_url}"'>)')
        else
            ((occurences_per_video++))
        fi

        if [ "${total_occurences_nb}" -le "${MAX_MATCHES}" ]; then
            timestamps_and_text="$(awk -F "${TSV_EXTENSION}"':' -- '{print $2}' <<< "${line}")"
            timestamp_start="$(("$(awk -F '\t' -- '{print $1}' <<< "${timestamps_and_text}")"/1000))"
            #timestamp_end="$(awk -F '\t' -- '{print $2}' <<< "${timestamps_and_text}" | sed -- 's/...$//')" # Pas d'utilité pour le moment... mais vu que ça dérange pas, ça peut rester ici si besoin un jour !
            ts_to_h="$(printf -- '%02d' "$((timestamp_start/3600))")"
            ts_to_m="$(printf -- '%02d' "$((timestamp_start/60%60))")"
            ts_to_s="$(printf -- '%02d' "$((timestamp_start%60))")"
            text="$(backticks_remover "$(awk -F '\t' -- '{for (i=3; i<=NF; i++) print $i}' <<< "${timestamps_and_text}")")"
            entire_text+=('    '"${SUB_BULLET_POINT_SYMBOL}"' ['"${ts_to_h}"':'"${ts_to_m}"':'"${ts_to_s}"'](<'"${video_url}"'&t='"${timestamp_start}"'>) : `'"${text}"'`')
        fi
    done <<< "${all_grepped_lines}"

    # Oui oui, "Beurk c'est laid ce doublon", mais j'ai pas d'autre solution pour afficher le nombre d'occurences de la dernière vidéo pour le moment...
    if [ "${total_occurences_nb}" -gt "${MAX_MATCHES}" ]; then
        last_element=$(("${#entire_text[@]}"-1))
        if [ "${occurences_per_video}" -eq '1' ]; then
            entire_text["${last_element}"]+=' *<'"${occurences_per_video}"' occurence>*'
        elif [ "${occurences_per_video}" -ge '2' ]; then
            entire_text["${last_element}"]+=' *<'"${occurences_per_video}"' occurences>*'
        fi
    fi


    if [ "${total_occurences_nb}" -gt "${MAX_MATCHES}" ]; then
        entire_text+=('### Trop de résultats pour afficher le détail des occurences')
    fi
    entire_text+=("$(show_footer)")
}


if [ "${#}" -lt '2' ]; then
    printf -- '%sUsage: %s <mode> <search>\n' "$(logs_date_severity 'C')" "${0}" >> "${LOG_FILE}"
    exit '1'
fi
if [ -z "${TSV_DIR}" ]; then
    printf -- '%sTSV_DIR environment variable is not defined, aborting\n' "$(logs_date_severity 'C')" >> "${LOG_FILE}"
    exit '2'
else
    [[ "${TSV_DIR}" != */ ]] && TSV_DIR="${TSV_DIR}"'/'
    if [ ! -d "${TSV_DIR}" ]; then
        printf -- '%sDirectory "%s" does not exist, aborting\n' "$(logs_date_severity 'C')" "${TSV_DIR}" >> "${LOG_FILE}"
        exit '3'
    fi
    if [ "$(find "${TSV_DIR}" -type 'f' -name '*'"${TSV_EXTENSION}" | wc -l --)" -eq '0' ]; then
        printf -- '%sDirectory "%s" does not contain any "%s" file, aborting\n' "$(logs_date_severity 'C')" "${TSV_DIR}" "${TSV_EXTENSION}" >> "${LOG_FILE}"
        exit '4'
    fi
fi
if "${DISCORD_ENABLE}"; then
    if [ -z "${DISCORD_TOKEN}" ]; then
        printf -- '%sDISCORD_TOKEN environment variable is not defined, aborting\n' "$(logs_date_severity 'C')" >> "${LOG_FILE}"
        exit '5'
    elif [ -z "${DISCORD_CHANNEL_ID}" ]; then
        printf -- '%sDISCORD_CHANNEL_ID environment variable is not defined, aborting\n' "$(logs_date_severity 'C')" >> "${LOG_FILE}"
        exit '6'
    fi
fi

case "${1}" in
    default)
        GREP_ARGS='i'
        GREP_MODE='normal'
        shift -- '1'
        ;;
    wholeword)
        GREP_ARGS='iw'
        GREP_MODE='mot entier'
        shift -- '1'
        ;;
    exact)
        GREP_ARGS=''
        GREP_MODE='correspondance exacte'
        shift -- '1'
        ;;
    wholeword-exact)
        GREP_ARGS='w'
        GREP_MODE='mot entier + correspondance exacte'
        shift -- '1'
        ;;
    *)
        GREP_ARGS='i'
        GREP_MODE='normal'
        printf -- '%sInvalid supplied GREP_MODE, using the default one ("%s")\n' "$(logs_date_severity 'W')" "${GREP_MODE}" >> "${LOG_FILE}"
        ;;
esac

main "${*}"
split_text_into_chunks "${entire_text[@]}"
