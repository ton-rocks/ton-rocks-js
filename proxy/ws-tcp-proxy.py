#!/usr/bin/env python3

import asyncio
import websockets
import binascii

import socket
import random

LITE_IP = '45.137.190.200'
#LITE_IP = '51.79.159.58'
LITE_PORT = 46732
BUFFER_SIZE = 102400


async def ws2tcp(ws, tcp):
    print('listening client')
    try:
        while True:
            data = await ws.recv()
            if len(data) > 0:
                print('request: ' + str(len(data)))
                #print(binascii.hexlify(bytearray(data)))
                #if random.choice([0,1]) == 0:
                #    print('Check error')
                #    data = bytearray(data)
                #    data[random.randint(0, len(data)-1)] = random.randint(0, 255)
                #    data = bytes(data)
                tcp.write(data)
    except websockets.exceptions.ConnectionClosedError as e:
        pass
    except websockets.exceptions.ConnectionClosedOK as e:
        pass
    except Exception as e:
        print('Error ws2tcp: ' + str(e))
    finally:
        print('ws2tcp end')
        tcp.close()


async def tcp2ws(tcp, ws):
    print('listening server')
    try:
        while not tcp.at_eof():
            #while True:
            data = await tcp.read(BUFFER_SIZE)
            if len(data) > 0:
                print('reply: ' + str(len(data)))
                await ws.send(data)
    finally:
        print('tcp2ws end')
        await ws.close()


async def handle_client(ws):
    try:
        remote_reader, remote_writer = await asyncio.wait_for(asyncio.open_connection(LITE_IP, LITE_PORT), timeout = 30)
        print('Connected to server')
        pipe1 = ws2tcp(ws, remote_writer)
        pipe2 = tcp2ws(remote_reader, ws)
        await asyncio.gather(pipe1, pipe2)
    except asyncio.TimeoutError:
        print('Timeout connecting to server')
    except Exception as e:
        print('Error connecting to server')
    finally:
        pass



async def hello(websocket, path):
    print('new client')
    #s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    #s.connect((LITE_IP, LITE_PORT))
    await handle_client(websocket)
    print('client disconnected')
    return

    print('connected to server')
    while True:
       data = await websocket.recv()
       if len(data) == 0:
           print('client disconnected')
           break
       print('request: ' + str(len(data)))
       print(binascii.hexlify(bytearray(data)))
       s.send(data)
       data = s.recv(BUFFER_SIZE)
       if len(data) > 0:
           print('reply: ' + str(len(data)))
           print(binascii.hexlify(bytearray(data)))
           await websocket.send(data)

    s.close()


    #await websocket.send(greeting)
    #print(f"> {greeting}")

start_server = websockets.serve(hello, "localhost", 7004)



asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
