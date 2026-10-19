import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const categories = [
  {
    key: 'NHAN_THUC_NGON_NGU',
    title: '1. Nhận thức- ngôn ngữ',
    topics: [
      'các bộ phận trên khuôn mặt', 'các bộ phận chính của cơ thể', 'đồ dùng trong phòng ngủ', 'đồ dùng trong nhà bếp',
      'đồ dùng học tập', 'trang phục theo thời tiết', 'con vật nuôi trong gia đình', 'động vật sống trong rừng',
      'động vật sống dưới nước', 'các loại côn trùng quen thuộc', 'trái cây theo mùa', 'rau củ thường dùng',
      'món ăn trong bữa sáng', 'phương tiện giao thông đường bộ', 'phương tiện giao thông đường thủy', 'nghề nghiệp của người thân',
      'hoạt động buổi sáng', 'hoạt động trước khi đi ngủ', 'cảm xúc vui buồn tức giận sợ hãi', 'từ chỉ hành động chạy nhảy ngồi đứng',
      'từ chỉ đặc điểm to nhỏ dài ngắn', 'từ trái nghĩa nóng lạnh nhanh chậm', 'vị trí trên dưới trước sau', 'vị trí trong ngoài gần xa',
      'đại từ con bạn cô chú', 'câu đề nghị giúp đỡ', 'câu hỏi ai ở đâu làm gì', 'trình tự một ngày của bé',
      'câu chuyện ba tranh liên tiếp', 'biển báo quen thuộc ở trường', 'âm thanh trong môi trường', 'thời tiết nắng mưa gió',
      'ngày trong tuần và hôm qua hôm nay ngày mai', 'thông tin cá nhân tên tuổi địa chỉ'
    ]
  },
  {
    key: 'NHAN_THUC_TU_DUY_MAU_SAC',
    title: '2. Nhận thức- Tư duy màu sắc',
    topics: [
      'màu đỏ và màu hồng', 'màu vàng và màu cam', 'màu xanh lá và xanh dương', 'màu tím và màu nâu',
      'màu đen trắng và xám', 'sắc độ đậm nhạt của một màu', 'hình tròn và hình vuông', 'hình tam giác và hình chữ nhật',
      'hình bầu dục và hình thoi', 'vật giống nhau hoàn toàn', 'vật khác nhau một đặc điểm', 'phân loại theo màu sắc',
      'phân loại theo hình dạng', 'phân loại theo kích thước', 'xếp thứ tự từ nhỏ đến lớn', 'xếp thứ tự từ thấp đến cao',
      'ghép đôi đồ vật có liên quan', 'ghép bóng với hình tương ứng', 'hoàn thành mẫu lặp AB', 'hoàn thành mẫu lặp AAB',
      'hoàn thành mẫu lặp ABC', 'đếm nhóm đồ vật trong phạm vi 3', 'đếm nhóm đồ vật trong phạm vi 5', 'đếm nhóm đồ vật trong phạm vi 10',
      'so sánh nhiều hơn ít hơn', 'so sánh bằng nhau và không bằng nhau', 'tìm vật còn thiếu trong tranh', 'tìm đường đi đơn giản trong mê cung',
      'ghép tranh hai mảnh', 'ghép tranh bốn đến sáu mảnh', 'nhận biết quy luật theo vị trí', 'sắp xếp trình tự ba sự kiện',
      'dự đoán kết quả trước một tình huống', 'chọn giải pháp phù hợp cho vấn đề đơn giản'
    ]
  },
  {
    key: 'TUONG_TAC',
    title: '3. Tương tác',
    topics: [
      'chào hỏi khi đến lớp', 'tạm biệt khi ra về', 'gọi tên bạn để thu hút chú ý', 'nhìn người đối diện khi giao tiếp',
      'chờ đến lượt trong trò chơi', 'đổi lượt với một bạn', 'chia sẻ đồ chơi yêu thích', 'mời bạn cùng tham gia',
      'yêu cầu giúp đỡ đúng cách', 'từ chối lịch sự', 'nói cảm ơn khi được giúp', 'xin lỗi sau khi làm bạn buồn',
      'hỏi mượn đồ dùng', 'trả lại đồ sau khi mượn', 'thực hiện nhiệm vụ theo cặp', 'cùng bạn hoàn thành tranh',
      'tham gia trò chơi vòng tròn', 'trò chơi tay có tay không', 'trò chơi chuyền bóng theo lượt', 'trò chơi đóng vai bán hàng',
      'trò chơi đóng vai bác sĩ', 'trò chơi đóng vai gia đình', 'nhận biết cảm xúc của bạn', 'an ủi khi bạn buồn',
      'khen sản phẩm của bạn', 'lắng nghe bạn kể chuyện', 'đặt câu hỏi cho bạn', 'thống nhất luật chơi chung',
      'giải quyết khi hai bạn cùng muốn một đồ chơi', 'tham gia dọn đồ chơi cùng nhóm', 'xin phép trước khi rời hoạt động', 'giữ khoảng cách phù hợp khi nói chuyện',
      'giới thiệu bản thân trước nhóm', 'hợp tác xây một công trình chung'
    ]
  },
  {
    key: 'BAT_CHUOC',
    title: '4. Bắt chước',
    topics: [
      'vỗ tay theo nhịp chậm', 'vỗ tay theo nhịp nhanh chậm xen kẽ', 'giơ tay và hạ tay', 'chạm lần lượt đầu vai gối chân',
      'làm động tác đánh răng', 'làm động tác rửa mặt', 'làm động tác chải tóc', 'làm động tác mặc áo',
      'bắt chước dáng đi của con mèo', 'bắt chước dáng nhảy của con thỏ', 'bắt chước tiếng kêu của vật nuôi', 'bắt chước âm thanh phương tiện',
      'thổi nến sinh nhật', 'thực hành sinh nhật của bé', 'khuấy và múc thức ăn giả vờ', 'gọi điện thoại giả vờ',
      'xếp ba khối theo mẫu', 'xếp mô hình cầu theo mẫu', 'vẽ nét thẳng theo mẫu', 'vẽ nét cong theo mẫu',
      'tạo hình tròn bằng hai tay', 'tạo chuỗi hai động tác', 'tạo chuỗi ba động tác', 'bắt chước biểu cảm vui buồn',
      'bắt chước khẩu hình a o i', 'lặp lại chuỗi hai âm tiết', 'lặp lại câu có bốn từ', 'hát nối tiếp một câu ngắn',
      'gõ nhạc cụ theo tiết tấu', 'di chuyển theo hiệu lệnh âm nhạc', 'bắt chước động tác nghề nghiệp', 'bắt chước tư thế yoga đơn giản',
      'sao chép mẫu màu theo thứ tự', 'diễn lại một cảnh ngắn vừa quan sát'
    ]
  },
  {
    key: 'VAN_DONG_TINH',
    title: '5. Vận động tinh',
    topics: [
      'nhặt hạt lớn bằng hai ngón tay', 'gắp pompom bằng kẹp gỗ', 'câu cá theo yêu cầu', 'xâu vòng hạt kích thước lớn',
      'xâu hạt theo hai màu xen kẽ', 'luồn dây qua bảng lỗ', 'cài và mở cúc áo lớn', 'kéo và đóng khóa kéo',
      'vặn mở nắp chai', 'kẹp quần áo quanh bìa giấy', 'bóc và dán sticker đúng vị trí', 'vo giấy thành viên tròn',
      'xé giấy theo dải', 'gấp giấy làm đôi', 'dán giấy trong đường viền', 'tô màu vùng hình lớn',
      'tô màu không vượt đường viền', 'nối hai điểm bằng nét thẳng', 'đồ theo nét cong', 'vẽ đường zích zắc',
      'vẽ hình tròn khép kín', 'sao chép hình vuông', 'cắt giấy theo đường thẳng', 'cắt giấy theo đường cong',
      'nặn đất thành viên tròn', 'lăn đất thành sợi dài', 'dùng kéo đất tạo sản phẩm', 'xếp khối nhỏ bằng đầu ngón tay',
      'ghép nút vào bảng cọc', 'dùng thìa chuyển hạt giữa hai bát', 'rót nước đến vạch', 'dùng đũa tập gắp miếng xốp',
      'viết các nét tiền chữ cái', 'tự phục vụ với thìa và cốc'
    ]
  },
  {
    key: 'VAN_DONG_THO',
    title: '6. Vận động thô',
    topics: [
      'đi thẳng theo vạch', 'đi bằng gót chạm mũi chân', 'đi ngang theo đường kẻ', 'đi lùi ba đến năm bước',
      'chạy đến đích theo hiệu lệnh', 'chạy đổi hướng qua cọc', 'bật liên tục vào vòng', 'bật bằng hai chân qua vạch',
      'nhảy lò cò có hỗ trợ', 'nhảy từ bục thấp xuống', 'bước lên xuống bậc thang', 'bò chui qua cổng',
      'bò theo đường zích zắc', 'trườn người về phía trước', 'leo thang vận động thấp', 'giữ thăng bằng trên một chân',
      'đứng trên bảng thăng bằng', 'ném bóng bằng hai tay', 'ném bóng trúng đích gần', 'bắt bóng bằng hai tay',
      'lăn bóng cho bạn', 'đá bóng vào khung thành', 'đập và bắt bóng nảy', 'chuyền bóng qua đầu',
      'mang vật nhẹ đi theo đường', 'kéo xe đồ chơi theo hướng', 'đẩy vật qua chướng ngại', 'vượt đường hầm vận động',
      'phối hợp tay chân theo nhạc', 'thực hiện bài tập thể dục bốn động tác', 'chơi trò đèn xanh đèn đỏ', 'chơi trò làm theo hiệu lệnh',
      'hoàn thành đường vận động liên hoàn', 'thả lỏng và hít thở sau vận động'
    ]
  }
]

const ageInstructions = {
  3: [
    topic => `Nhận biết và thực hành ${topic} qua vật thật hoặc tranh, dùng từ/cụm 2-3 từ khi có gợi ý.`,
    topic => `Khám phá ${topic} bằng thao tác ghép, chọn hoặc phân loại với tối đa 3 lựa chọn.`,
    topic => `Tham gia ${topic} cùng một bạn trong 3-5 phút, có cô hỗ trợ nhắc lượt.`,
    topic => `Quan sát rồi bắt chước ${topic} theo từng bước đơn, lặp lại 2 lần.`,
    topic => `Luyện ${topic} trong 5 phút, ưu tiên phối hợp mắt và hai bàn tay.`,
    topic => `Thực hiện ${topic} ở cự ly ngắn, hoàn thành 2-3 lượt với hỗ trợ khi cần.`
  ],
  4: [
    topic => `Mô tả ${topic} bằng câu 4-5 từ và trả lời một câu hỏi ai, gì hoặc ở đâu.`,
    topic => `Thực hiện nhiệm vụ về ${topic} với 4-5 lựa chọn và tự giải thích cách chọn bằng câu ngắn.`,
    topic => `Chủ động thực hành ${topic} cùng 1-2 bạn trong 5-7 phút và chờ đúng lượt.`,
    topic => `Bắt chước ${topic} thành chuỗi hai bước sau một lần quan sát.`,
    topic => `Thực hành ${topic} chính xác trong 7 phút, giảm dần trợ giúp của người lớn.`,
    topic => `Hoàn thành ${topic} trong 3-4 lượt, phối hợp hiệu lệnh và giữ an toàn.`
  ],
  5: [
    topic => `Giải thích ${topic} bằng câu đầy đủ, nêu ít nhất hai đặc điểm hoặc công dụng liên quan.`,
    topic => `Giải quyết bài tập ${topic} có 6-8 lựa chọn, nêu quy luật và tự kiểm tra kết quả.`,
    topic => `Tổ chức ${topic} cùng nhóm 3 bạn trong 8-10 phút, biết trao đổi và thống nhất lượt.`,
    topic => `Ghi nhớ rồi tái hiện ${topic} thành chuỗi ba bước đúng thứ tự.`,
    topic => `Hoàn thành ${topic} trong 10 phút với độ chính xác tốt và tư thế cầm nắm phù hợp.`,
    topic => `Thực hiện ${topic} qua 4-5 lượt liên tục, biết điều chỉnh tốc độ và hướng di chuyển.`
  ],
  6: [
    topic => `Kể hoặc viết 3-4 câu về ${topic}, sử dụng từ nối và tự sửa câu chưa rõ nghĩa.`,
    topic => `Giải quyết thử thách ${topic} theo hai điều kiện, trình bày cách suy luận và phương án khác.`,
    topic => `Dẫn dắt ${topic} trong nhóm 4 bạn, phân công đơn giản và xử lý một tình huống phát sinh.`,
    topic => `Quan sát một lần rồi tái hiện ${topic} thành chuỗi bốn bước, có thay đổi nhịp hoặc thứ tự.`,
    topic => `Thực hiện ${topic} độc lập trong 10-12 phút, chú ý tốc độ, độ chính xác và hoàn thiện sản phẩm.`,
    topic => `Luyện ${topic} trong đường vận động có luật, duy trì nhịp và tự đánh giá kết quả.`
  ]
}

const outputDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'plan-templates')
const escapeCsv = value => `"${String(value).replaceAll('"', '""')}"`
await fs.mkdir(outputDir, { recursive: true })
const allContents = new Set()

for (const age of [3, 4, 5, 6]) {
  const rows = []
  categories.forEach((category, categoryIndex) => {
    const limit = categoryIndex < 2 ? 34 : 33
    category.topics.slice(0, limit).forEach((topic, topicIndex) => {
      rows.push([
        `AGE${age}_${category.key}_${String(topicIndex + 1).padStart(3, '0')}`,
        age,
        category.key,
        category.title,
        ageInstructions[age][categoryIndex](topic)
      ])
    })
  })
  if (rows.length !== 200) throw new Error(`Tuổi ${age}: cần đúng 200 dòng, hiện có ${rows.length}`)
  if (new Set(rows.map(row => row[0])).size !== rows.length) throw new Error(`Tuổi ${age}: ID bị trùng`)
  if (new Set(rows.map(row => row[4])).size !== rows.length) throw new Error(`Tuổi ${age}: nội dung bị trùng`)
  if (new Set(rows.map(row => row[2])).size !== 6) throw new Error(`Tuổi ${age}: không đủ 6 nhóm`)
  for (const row of rows) {
    if (allContents.has(row[4])) throw new Error(`Nội dung bị trùng giữa các độ tuổi: ${row[4]}`)
    allContents.add(row[4])
  }
  const header = ['id', 'age', 'categoryKey', 'categoryTitle', 'content']
  const csv = '\uFEFF' + [header, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n') + '\n'
  await fs.writeFile(path.join(outputDir, `plan-age-${age}.csv`), csv, 'utf8')
}
