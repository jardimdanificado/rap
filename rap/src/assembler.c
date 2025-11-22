#include "urb.h"
// urb.c is a generated file
#include "../../build/urb.c"
#include "stdarg.h"
#include <stddef.h>

// file stuff
char* file_read(char *filename)
{
    FILE *file = fopen(filename, "r");
    if (file == NULL)
    {
        return NULL;
    }

    char *code = (char*)malloc(1);
    if (code == NULL)
    {
        printf("ERROR: could not allocate memory for file\n");
        fclose(file);
        return NULL;
    }

    code[0] = '\0';

    char *line = NULL;
    size_t len = 0;
    while (getline(&line, &len, file) != -1)
    {
        size_t new_size = strlen(code) + strlen(line) + 1;
        char *temp = realloc(code, new_size);
        if (temp == NULL)
        {
            printf("ERROR: could not reallocate memory while reading file\n");
            free(code);
            free(line);
            fclose(file);
            return NULL;
        }
        code = temp;
        strcat(code, line);
    }

    free(line);
    fclose(file);
    return code;
}

//string functions
char* str_duplicate(const char *str)
{
    char *dup = (char*)malloc(strlen(str) + 1);
    strcpy(dup, str);
    return dup;
}

char* str_nduplicate(const char *str, Int n)
{
    char *dup = (char*)malloc(n + 1);
    for (Int i = 0; i < n; i++)
    {
        dup[i] = str[i];
    }
    dup[n] = '\0';
    return dup;
}

List* str_split(char *str, char *delim)
{
    List *splited = urb_new(URB_DEFAULT_SIZE);

    char* newstring = strdup(str);
    char* token = strtok(newstring, delim);

    while (token != NULL)
    {
        urb_push(splited, (Value){.p = str_duplicate(token)});
        token = strtok(NULL, delim);
    }
    free(newstring);

    return splited;
}

static Int escaped_length(const char *token)
{
    Int len = 0;
    for (Int i = 1; token[i] && token[i] != '"'; i++)
    {
        if (token[i] == '\\')
        {
            i++;
            if (!token[i]) break;

            switch (token[i])
            {
                case 'x': {
                    // hexadecimal escape: \xNN...
                    int count = 0;
                    while (isxdigit(token[i + 1]) && count < 2) {
                        i++;
                        count++;
                    }
                    len++;
                } break;

                case 'u': {
                    // \uXXXX (opcional)
                    int count = 0;
                    while (isxdigit(token[i + 1]) && count < 4) {
                        i++;
                        count++;
                    }
                    len++;
                } break;

                case 'U': {
                    // \UXXXXXXXX (opcional)
                    int count = 0;
                    while (isxdigit(token[i + 1]) && count < 8) {
                        i++;
                        count++;
                    }
                    len++;
                } break;

                case '0': case '1': case '2': case '3':
                case '4': case '5': case '6': case '7': {
                    // octal escape: \nnn (até 3 dígitos)
                    int count = 0;
                    while (token[i + 1] >= '0' && token[i + 1] <= '7' && count < 2) {
                        i++;
                        count++;
                    }
                    len++;
                } break;

                default:
                    len++;
                    break;
            }
        }
        else len++;
    }
    return len;
}


Int bytecount_to_wordcount(Int bytecount)
{
    Int values_needed = bytecount;

    while (values_needed % sizeof(Int) != 0)
        values_needed++;

    values_needed /= sizeof(Int);
    return values_needed;
}

static inline List* rap_assemble(char* input_str)
{
    List* code = urb_new(URB_DEFAULT_SIZE);
    List* label_values = urb_new(URB_DEFAULT_SIZE);
    List* label_names = urb_new(URB_DEFAULT_SIZE);
    List* tokens = str_split(input_str, "\n\r \t");

    Int label_correction = 0;
    for(UInt i = 0; i < tokens->size; i++)
    {
        char* token = tokens->data[i].p;
        if (token[0] == '\\')
        {
            label_correction += bytecount_to_wordcount(escaped_length(token));
        }
        else if(strchr(token, ':'))
        {
            token[strlen(token)-1] = 0;
            urb_push(label_names, (Value){.p = token});
            urb_push(label_values, (Value){.u = i + label_correction});
            urb_remove(tokens, i);
            i--;
        }
    }

    for(UInt i = 0; i < tokens->size; i++)
    {
        char* token = tokens->data[i].p;
        switch (token[0])
        {
            case '0':
                if(token[1] == 'b')
                {
                    urb_push(code, (Value){.i = strtol(token + 2, NULL, 2)});
                    break;
                }
                else if(token[1] == 'x')
                {
                    urb_push(code, (Value){.i = strtol(token + 2, NULL, 16)});
                    break;
                }
                else if(token[1] == 'o')
                {
                    urb_push(code, (Value){.i = strtol(token + 2, NULL, 8)});
                    break;
                }
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                if(strchr(token, 'f'))
                {
                    urb_push(code, (Value){.f = strtod(token, NULL)});
                }
                else
                {
                    urb_push(code, (Value){.u = strtol(token, NULL, 10)});
                }
            break;
            
            // char
            case '\'':
            {
                urb_push(code, (Value){.u = token[1]});
            }
            break;

            case '@':
            {
                if (token[1] >= '0' && token[1] <= '9')
                {
                    urb_push(code, (Value){.i = INT_MAX - strtol(token + 1, NULL, 10)});
                }
                else 
                {
                    for(UInt j = 0; j < label_names->size; j++)
                    {
                        if(strcmp(token + 1, label_names->data[j].p) == 0)
                        {
                            urb_push(code, (Value){.i = INT_MAX - (label_values->data[j].i)});
                            break;
                        }
                    }
                }
            }
            break;

            case '\\': {
                Int temp_result_size = escaped_length(token) + sizeof(Int);
                char *result_str = malloc(temp_result_size);
                if (!result_str) abort();

                Int current_char = 0;
                Int i = 1;

                while (token[i] && token[i] != '"' && current_char < temp_result_size)
                {
                    char c = token[i];

                    if (c == '\\')
                    {
                        i++;
                        if (!token[i]) break;

                        switch (token[i])
                        {
                            case 'n': c = '\n'; break;
                            case 't': c = '\t'; break;
                            case 'r': c = '\r'; break;
                            case 'v': c = '\v'; break;
                            case 'f': c = '\f'; break;
                            case 'a': c = '\a'; break;
                            case 'b': c = '\b'; break;
                            case 's': c = ' '; break;
                            case '\\': c = '\\'; break;
                            case '"': c = '"'; break;
                            case '\'': c = '\''; break;

                            case 'x': {
                                i++;
                                int val = 0, count = 0;
                                while (isxdigit(token[i]) && count < 2) {
                                    char d = token[i++];
                                    val = val * 16 + (isdigit(d) ? d - '0' : (tolower(d) - 'a' + 10));
                                    count++;
                                }
                                i--;
                                c = (char)val;
                            } break;

                            case '0': case '1': case '2': case '3':
                            case '4': case '5': case '6': case '7': {
                                int val = token[i] - '0';
                                int count = 0;
                                while (token[i + 1] >= '0' && token[i + 1] <= '7' && count < 2) {
                                    i++;
                                    val = (val * 8) + (token[i] - '0');
                                    count++;
                                }
                                c = (char)val;
                            } break;

                            default:
                                c = token[i];
                                break;
                        }
                    }

                    result_str[current_char++] = c;
                    i++;
                }

                result_str[current_char] = '\0';

                Int values_needed = bytecount_to_wordcount(temp_result_size);
                Int starting_index = code->size;

                for (Int j = 0; j < values_needed; j++)
                    urb_push(code, (Value){.i = 0});

                memcpy(&code->data[starting_index], result_str, current_char + 1);
                free(result_str);
            } 
            break;


            default:
            {
                
                bool found = 0;
                for(UInt j = 0; j < CUSTOM_FUNC_COUNT; j++)
                {
                    if(strcmp(token, custom_func_names[j]) == 0)
                    {
                        urb_push(code, (Value){.i = custom_func_opcodes[j]});
                        found = true;
                        break;
                    }
                }
                if(found) break;

                if(strcmp(token, "goto") == 0)
                {
                    urb_push(code, (Value){.i = ALIAS_GOTO});
                    break;
                }
                else if(strcmp(token, "goif") == 0)
                {
                    urb_push(code, (Value){.i = ALIAS_GOIF});
                    break;
                }
                else if(strcmp(token, "goie") == 0)
                {
                    urb_push(code, (Value){.i = ALIAS_GOIE});
                    break;
                }
                else if (strcmp(token, "exec") == 0)
                {
                    urb_push(code, (Value){.i = ALIAS_EXEC});
                    break;
                }
                else if (strcmp(token, "mem") == 0)
                {
                    urb_push(code, (Value){.i = ALIAS_MEM});
                    break;
                }
                else if (strcmp(token, "args") == 0)
                {
                    urb_push(code, (Value){.i = ALIAS_ARGS});
                    break;
                }
                
                for(UInt j = 0; j < label_names->size; j++)
                {
                    if(strcmp(token, label_names->data[j].p) == 0)
                    {
                        urb_push(code, (Value){.i = label_values->data[j].i});
                        found = true;
                        break;
                    }
                }
                if(found) break;
            }
            break;
        }
        free(token);
    }

    while(label_names->size >  0)
    {
        free(urb_pop(label_names).p);
    }
    
    urb_free(label_names);
    urb_free(label_values);
    urb_free(tokens);
    return code;
}

int main(int argc, char* argv[])
{
    if (argc <= 1)
    {
        printf("you need to pass a filename.\n");
        return 1;
    }

    if (strcmp(argv[1], "opcodes") == 0)
    {
        printf("available opcodes:\n");
        for(Int i = 0; i < CUSTOM_FUNC_COUNT; i++)
        {
            printf("[%d] %s\n", i, custom_func_names[i]);
        }
        return 0;
    }
    
    char* file_content = file_read(argv[1]);
    
    List* assembled = rap_assemble(file_content);
    
    char* binary = malloc(sizeof(Int) * (assembled->size + 1));

    Int normalized_size = assembled->size;

    // we copy the metadata(.size and .capacity)
    memcpy(binary, &normalized_size, sizeof(Int));
    
    // we copy the content(.data)
    memcpy(binary + sizeof(Int), assembled->data, assembled->size * sizeof(Int));

    fwrite(binary, sizeof(Int), assembled->size + 1, stdout);
    free(file_content);
    urb_free(assembled);
    free(binary);
    return 0;
};