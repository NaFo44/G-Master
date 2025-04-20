#!/bin/bash

# définir les variables d'environnement "TSV_DIR" et "DISCORD_TOKEN"
ENABLE_DISCORD='true'

MAX_MATCHES='100'
MIN_CHARS='5'

if [ -z "${TSV_DIR}" ]; then
    printf -- 'TSV_DIR environment variable is not defined, aborting\n'
    exit '2'
elif [ -z "${DISCORD_TOKEN}" ]; then
    printf -- 'DISCORD_TOKEN environment variable is not defined, aborting\n'
    exit '2'
fi

entire_text=''

backticks_remover() {
    sed -- 's/`//g' <<< "${1}"
}

keep_alnum_only() {
    sed -- 's/＊/$/g; s/[^a-zA-Z0-9ÀàÂâÇçÉéÈèÊêËëÎîÏïijÔôÙùÛûÜü .,?!;%$()«»@+"&:'"'"'-]*//g; s/  +/ /g; s/^[ ]*//; s/[ ]*$//' <<< "${1}"
}

show_footer() {
    printf -- '-# \*cette recherche étant effectuée sur des transcriptions des vidéos de G Milgram réalisées avec [Whisper](<https://github.com/openai/whisper>), les résultats sont susceptibles de contenir des erreurs !\n'
}

send_message_to_discord() {
    local message
    message="$(jq -n --arg content "${1}" '{"content": $content}')"
    if "${ENABLE_DISCORD}"; then
        if ! timeout -- '3' curl \
          -d "${message}" \
          -H 'Authorization: Bot '"${DISCORD_TOKEN}" \
          -H "Content-Type: application/json" \
          -X 'POST' \
          'https://discordapp.com/api/channels/1363504473514840194/messages'; then
            return '2'
        fi
        sleep -- '0.5'
    else
        printf -- "${message}"
    fi

}

main() {
    search="$(backticks_remover "${1}")"
    if [ "${#search}" -lt "${MIN_CHARS}" ]; then
        entire_text='### Pas assez de caractères pour lancer une recherche, merci d'"'"'en taper au moins '"${MIN_CHARS}"
        return '1'
    fi
    all_lines="$(grep -FHir -- "${search}" "${TSV_DIR}" | sed -- 's%'"${TSV_DIR}"'%%' | sort -k '1' -n -s -t '.' -- | sed -- 's/^$//')"
    total_occurences_nb="$(wc -l <<< "${all_lines}")"
    
    if [ -z "${all_lines}" ]; then # "wc -l" returns 1 even if "${all_lines}" is empty (instead of 0)
        entire_text="$(printf -- '### Le terme `%s` semble\* n'"'"'avoir jamais été prononcé dans une vidéo de G\n' "${search}")"
        entire_text="${entire_text}\n$(show_footer)"
        return '1'
    elif [ "${total_occurences_nb}" -eq '1' ]; then
        entire_text="$(printf -- '### Le terme `%s` semble\* avoir été prononcé %s fois dans la vidéo suivante :\n' "${search}" "${total_occurences_nb}")"
    else
        entire_text="$(printf -- '### Le terme `%s` semble\* avoir été prononcé %s fois au total dans les vidéos suivantes :\n' "${search}" "${total_occurences_nb}")"
    fi

    last_video=''
    while IFS= read -r -- 'line'; do
        line_without_number="$(awk -F '.tsv:' -- '{print $1}' <<< "${line}" | cut -c '6-' --)"
        video_id="${line_without_number: -11}"
        video_name="$(keep_alnum_only "$(basename "${line_without_number}" '.'"${video_id}")")"
        video_url='https://www.youtube.com/watch?v='"${video_id}"

        if [ "${last_video}" != "${video_id}" ]; then
            last_video="${video_id}"
            entire_text="${entire_text}\n$(printf -- '- [%s](%s)\n' "${video_name}" '<'"${video_url}"'>')"
        fi

        if [ "${total_occurences_nb}" -lt "${MAX_MATCHES}" ]; then
            timestamps_and_text="$(awk -F '.tsv:' -- '{print $2}' <<< "${line}")"
            timestamp_start="$(awk -F '\t' -- '{print $1}' <<< "${timestamps_and_text}" | sed -- 's/...$//')"
            #timestamp_end="$(awk -F '\t' -- '{print $2}' <<< "${timestamps_and_text}" | cut -c '-3')"
            ts_to_h="$(printf -- '%02d' "$((timestamp_start/3600))")"
            ts_to_m="$(printf -- '%02d' "$((timestamp_start/60%60))")"
            ts_to_s="$(printf -- '%02d' "$((timestamp_start%60))")"
            text="$(backticks_remover "$(awk -F '\t' -- '{for (i=3; i<=NF; i++) print $i}' <<< "${timestamps_and_text}")")"

            entire_text="${entire_text}\n$(printf -- '  - [%s:%s:%s](%s) : `%s`\n' "${ts_to_h}" "${ts_to_m}" "${ts_to_s}" '<'"${video_url}"'&t='"${timestamp_start}"'>' "${text}")"
        fi
    done <<< "${all_lines}"

    if [ "${total_occurences_nb}" -ge "${MAX_MATCHES}" ]; then
        entire_text="${entire_text}\n$(printf -- '### Trop de résultats pour afficher toutes les correspondances, merci d'"'"'affiner la recherche\n')"
    fi
    entire_text="${entire_text}\n$(show_footer)"
}

main "${*}" #2> '/dev/null'

### ATTENTION : CODE GÉNÉRÉ PAR MISTRAL AI
split_text_into_chunks() {
    local text="$1"
    local max_chunk_size=1990
    local IFS=$'\n'
    local paragraphs=($(echo -e "$text"))
    local chunks=()
    local current_chunk=()
    local current_length=0

    for paragraph in "${paragraphs[@]}"; do
        if (( current_length + ${#paragraph} + 1 > max_chunk_size )); then
            chunks+=("$(printf "%s\n" "${current_chunk[*]}")")
            current_chunk=()
            current_length=0
        fi

        current_chunk+=("$paragraph")
        ((current_length += ${#paragraph} + 1))  # +1 for the newline character
    done

    if [ ${#current_chunk[@]} -ne 0 ]; then
        chunks+=("$(printf "%s\n" "${current_chunk[*]}")")
    fi

    local total_chunks=${#chunks[@]}
    local chunk_index=1

    for chunk in "${chunks[@]}"; do
        send_message_to_discord "$(printf -- '%s\n-# [%d/%d]' "$chunk" "${chunk_index}" "${total_chunks}")"
        #printf -- '--- End of chunk ---\n'  # Optional: to visually separate chunks
        ((chunk_index++))
    done
}

split_text_into_chunks "${entire_text}"
