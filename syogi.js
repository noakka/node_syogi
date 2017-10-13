var http = require('http');
var mysql = require('mysql');


//サーバインスタンス作成
var server = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type':'text/html'});
  res.end('server connected');
});
var io = require('socket.io').listen(server);

server.listen(2222); //2222番ポートで起動


var json = require('../../../syogi/koma.json');


// DB に接続
var connection = mysql.createConnection({
  host : 'localhost',
  user : '****',
  password : '****',
  database : '****'
});


// IDとルーム名
var store = {};


// 将棋用のコネクション作成
var syogi = io.of('/syogi').on('connection', function(socket) {

  // 部屋一覧の検索
  socket.on('client_to_server_room_list', function(data) {
    //var socket_id = socket.id;
    search_roomList();
  });


  // 部屋の作成
  socket.on('client_to_server_add_room', function(data) {
    var room = data.room;
    var id = socket.id;
    add_room(room, id);
  });


  // 部屋に入る
  socket.on('client_to_server_join', function(data) {
    var id = data.id;
    var socket_id = socket.id;
    store[socket_id] = id;

    enter_room(id);
    socket.join(id);

    // 先攻/後攻決定用の乱数
    var turn = Math.floor(Math.random()*101);
    syogi.to(id).emit("server_to_client_turn", {turn:turn});
  });


  // 順番の決定
  socket.on('client_to_server_turn', function(data) {
    var room = data.room;
    var turn = data.turn;
    socket.broadcast.to(room).emit('server_to_client_turn_change', {turn:turn});
    syogi.to(room).emit('server_to_client_start', "");
  });


  // 駒選択時の処理
  socket.on('client_to_server_koma_select', function(data) {
    var socket_id = socket.id;
    var x = data.x;
    var y = data.y;
    var koma = data.koma;
    var name = data.name;

    syogi.to(socket.id).emit('server_to_client_koma_select', {x:x, y:y, koma:koma, name:name, json:json[name]});
  });


  // 移動情報を相手に送信する
  socket.on('client_to_server_move_info', function(data) {
    room = data.room;
    socket.broadcast.to(room).emit('server_to_client_move_info', {data});
  });


  // 置く情報を相手に送信する
  socket.on('client_to_server_put_info', function(data) {
    room = data.room;
    socket.broadcast.to(room).emit('server_to_client_put_info', {data});
  });


  socket.on('client_to_server_exit_room', function(data) {
    socket.leave(data);
  });


  // 切断時に退出メッセージを送信する
  socket.on('disconnect', function() {
    var id = socket.id;
    socket.to(store[id]).emit('server_to_client_disconnect', '');
  });
});


  // 部屋一覧の取得
  function search_roomList() {
    connection.query({
      sql : 'select * from syogi_rooms where num<2',
      timeout : 40000
    }, function (error, results, fields) {
      if (error) {
        console.log('error : ' + error);
      } else {
        syogi.emit('server_to_client_room_list', {room : results});
      }
    });
  }


  // 入室時の処理
  function enter_room(id) {
    connection.query({
      sql : 'update syogi_rooms set num=num+1 where id=?',
      timeout : 40000,
      values : [id]
    }, function (error, results, fields) {
      if (error) {
        console.log('error : ' + error);
      } else {
        // 部屋の入室人数の確認と送信
        connection.query({
          sql : 'select num from syogi_rooms where id=?',
          timeout : 40000,
          values : [id]
        }, function (error, results, fields) {
          if (results[0].num > 1) {
            delete_room();
          }
          syogi.emit('server_to_client_room_num', {id:id, num:results[0].num});
        });
      }
    });
  }


  // 部屋の作成処理
  function add_room(room, id) {
    connection.query({
      sql : 'insert into syogi_rooms(room, num) value(?, "0")',
      timeout : 40000,
      values : [room]
    }, function (error, results, fields) {
      if (error) {
        console.log('error : ' + error);
      } else {
        search_roomList();
        syogi.to(id).emit('server_to_client_add_room', {id : results.insertId});
      }
    });
  }


  // 部屋の削除
  function delete_room(id) {
    connection.query({
      sql : 'delete from syogi_rooms where id=?',
      timeout : 40000,
      values : [id]
    }, function (error, results, fields) {
      if (error) {
        console.log('error : ' + error);
      }
    });
  }
