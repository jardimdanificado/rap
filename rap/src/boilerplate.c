#include "urb.h"
#include "urb.c"

//urb_content_replacement

// WE USE A UNUSED SPECIAL OPCODE
// urb has 8 reserved special opcodes but only uses 3 of them
#define ALIAS_ARGS ALIAS_ARGS

int main(int argc, char* argv[])
{
    List* exec = urb_new(URB_DEFAULT_SIZE);
    INIT_URB(exec);

    Int args_size = 1;
    while(argc > args_size) 
        args_size *= 2;
    List* args = urb_new(args_size);

    for (Int i = 0; i < argc; i++)
    {
        urb_push(args, (Value){.p = argv[i]});
    }
 
    Int code_size = (embedded_code_len/sizeof(Int))-1;
    Int code_capacity = 1;

    while(code_size > code_capacity) 
        code_capacity *= 2;
    
    List* code = urb_new(code_capacity);
    code->size = code_size;
    memcpy(code->data, embedded_code + sizeof(Int), embedded_code_len-sizeof(Int));
    
    for (Int i = 0; i < code->size; i++)
    {
        if(code->data[i].i == ALIAS_ARGS)
        {
            code->data[i].p = args;
        }
    }
    
    urb_interpret(exec, code, NULL);

    urb_free(exec);
    urb_free(code);
    urb_free(args);
};