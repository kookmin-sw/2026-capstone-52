import { dashboardGraphSlotIds, getGraphLayoutSlot } from "../graph/layout";
import type { Chat } from "./types";

export type ProjectKnowledgeGraphEvent = {
  id: string;
  chatId: string;
  messageId: string | null;
  preview: string;
  updatedAt: string;
};

export type ProjectKnowledgeGraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  isCore?: boolean;
  kind: "concept" | "chat" | "project";
  subtitle: string;
  description: string;
  relatedConceptIds: string[];
  relatedLearningEvents: ProjectKnowledgeGraphEvent[];
  keywords?: string[];
};

export type ProjectKnowledgeGraphEdge = {
  source: string;
  target: string;
};

export type ProjectKnowledgeGraphData = {
  nodes: ProjectKnowledgeGraphNode[];
  edges: ProjectKnowledgeGraphEdge[];
  defaultSelectedNodeId: string | null;
};

type BackendGraphNode = {
  node_id: string;
  name: string;
  description?: string | null;
  group?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

type BackendGraphEdge = {
  source_node_id: string;
  target_node_id: string;
};

type BackendGraphData = {
  nodes?: BackendGraphNode[];
  edges?: BackendGraphEdge[];
};

type ProjectDataInput = {
  projectId: string;
  title: string;
};

type IntegratedProjectGraphInput = {
  project: ProjectDataInput;
  graph: ProjectKnowledgeGraphData;
};

type GraphConceptPreset = {
  key: string;
  label: string;
  description: string;
  relatedKeys: string[];
  keywords: string[];
};

type GraphProjectPreset = {
  subject: string;
  coreLabel: string;
  coreDescription: string;
  coreKeywords: string[];
  concepts: GraphConceptPreset[];
};

const graphProjectPresets: Record<string, GraphProjectPreset> = {
  calculus: {
    subject: "미적분",
    coreLabel: "접선",
    coreDescription: "곡선 위 한 점에서의 순간 변화 방향을 대표하는 핵심 개념입니다.",
    coreKeywords: ["접선", "기울기", "변화율", "미분계수"],
    concepts: [
      {
        key: "slope",
        label: "기울기",
        description: "직선이나 접선이 얼마나 가파르게 변하는지를 나타내는 값입니다.",
        relatedKeys: ["rate", "line-equation", "tangent"],
        keywords: ["기울기", "slope"],
      },
      {
        key: "rate",
        label: "변화율",
        description: "입력값이 변할 때 출력값이 얼마나 바뀌는지 보는 관점입니다.",
        relatedKeys: ["slope", "derivative"],
        keywords: ["변화율", "평균변화율", "순간 변화율"],
      },
      {
        key: "derivative",
        label: "미분계수",
        description: "한 점에서의 순간 변화율을 수식으로 표현한 값입니다.",
        relatedKeys: ["rate", "tangent"],
        keywords: ["미분계수", "미분"],
      },
      {
        key: "line-equation",
        label: "직선의 방정식",
        description: "기울기와 한 점을 이용해 접선의 식을 세울 때 연결되는 표현입니다.",
        relatedKeys: ["slope", "tangent"],
        keywords: ["직선의 방정식", "방정식", "점기울기"],
      },
      {
        key: "tangent",
        label: "순간 변화율",
        description: "접선이 특정 점에서 곡선의 변화를 대표한다는 해석을 담고 있습니다.",
        relatedKeys: ["slope", "rate", "derivative"],
        keywords: ["접선", "순간 변화율"],
      },
    ],
  },
  os: {
    subject: "운영체제",
    coreLabel: "운영체제",
    coreDescription: "CPU를 빠르게 쓰는 것보다 각 프로세스가 정해진 비율만큼 CPU를 사용하도록 공정성을 맞추는 스케줄링 관점입니다.",
    coreKeywords: ["비례 배분", "공정 배분", "스케줄링", "proportional share"],
    concepts: [
      {
        key: "operating-system",
        label: "운영체제",
        description: "하드웨어 자원을 관리하고 사용자 프로그램이 실행될 수 있는 환경을 제공하는 시스템 소프트웨어입니다.",
        relatedKeys: ["kernel", "process", "memory-management", "file-system"],
        keywords: ["os", "운영체제", "시스템 소프트웨어", "자원 관리"],
      },
      {
        key: "kernel",
        label: "커널",
        description: "운영체제의 핵심 부분으로 CPU, 메모리, 입출력 장치 같은 하드웨어 자원을 직접 관리합니다.",
        relatedKeys: ["operating-system", "system-call", "interrupt", "kernel-mode"],
        keywords: ["kernel", "커널", "핵심", "자원 관리"],
      },
      {
        key: "user-mode",
        label: "사용자 모드",
        description: "일반 응용 프로그램이 실행되는 제한된 권한의 실행 모드입니다.",
        relatedKeys: ["kernel-mode", "system-call", "protection"],
        keywords: ["user mode", "사용자 모드", "제한 권한"],
      },
      {
        key: "kernel-mode",
        label: "커널 모드",
        description: "운영체제 커널이 하드웨어와 시스템 자원에 직접 접근할 수 있는 권한을 가진 실행 모드입니다.",
        relatedKeys: ["user-mode", "kernel", "system-call"],
        keywords: ["kernel mode", "커널 모드", "특권 모드"],
      },
      {
        key: "system-call",
        label: "시스템 콜",
        description: "사용자 프로그램이 파일 입출력, 프로세스 생성, 메모리 할당 같은 운영체제 서비스를 요청하는 인터페이스입니다.",
        relatedKeys: ["kernel", "user-mode", "kernel-mode"],
        keywords: ["system call", "시스템 콜", "운영체제 서비스"],
      },
      {
        key: "interrupt",
        label: "인터럽트",
        description: "CPU가 현재 실행 흐름을 잠시 중단하고 외부 또는 내부 사건을 처리하도록 만드는 신호입니다.",
        relatedKeys: ["trap", "exception", "interrupt-handler"],
        keywords: ["interrupt", "인터럽트", "CPU 중단", "이벤트"],
      },
      {
        key: "trap",
        label: "트랩",
        description: "프로그램 실행 중 의도적으로 발생시키는 소프트웨어 인터럽트로, 주로 시스템 콜 처리에 사용됩니다.",
        relatedKeys: ["interrupt", "system-call", "exception"],
        keywords: ["trap", "트랩", "소프트웨어 인터럽트"],
      },
      {
        key: "exception",
        label: "예외",
        description: "프로그램 실행 중 0으로 나누기, 잘못된 메모리 접근처럼 비정상적인 상황에서 발생하는 제어 흐름 변경입니다.",
        relatedKeys: ["interrupt", "trap", "page-fault"],
        keywords: ["exception", "예외", "오류", "비정상 상황"],
      },
      {
        key: "interrupt-handler",
        label: "인터럽트 핸들러",
        description: "인터럽트가 발생했을 때 해당 사건을 처리하기 위해 실행되는 커널 코드입니다.",
        relatedKeys: ["interrupt", "kernel", "isr"],
        keywords: ["interrupt handler", "인터럽트 핸들러", "ISR"],
      },
      {
        key: "isr",
        label: "ISR",
        description: "Interrupt Service Routine의 약자로, 인터럽트 발생 시 실행되는 서비스 루틴입니다.",
        relatedKeys: ["interrupt-handler", "interrupt"],
        keywords: ["ISR", "interrupt service routine", "인터럽트 서비스 루틴"],
      },

      {
        key: "process",
        label: "프로세스",
        description: "실행 중인 프로그램의 인스턴스로, 코드, 데이터, 힙, 스택, 실행 상태를 포함합니다.",
        relatedKeys: ["thread", "pcb", "process-state"],
        keywords: ["process", "프로세스", "실행 중인 프로그램"],
      },
      {
        key: "program",
        label: "프로그램",
        description: "디스크에 저장된 실행 가능한 정적 코드이며, 실행되면 프로세스가 됩니다.",
        relatedKeys: ["process", "loader", "executable"],
        keywords: ["program", "프로그램", "실행 파일"],
      },
      {
        key: "thread",
        label: "스레드",
        description: "프로세스 내부에서 실행되는 작업 흐름의 단위로, 같은 프로세스의 자원을 공유합니다.",
        relatedKeys: ["process", "multithreading", "thread-control-block"],
        keywords: ["thread", "스레드", "실행 흐름", "자원 공유"],
      },
      {
        key: "multithreading",
        label: "멀티스레딩",
        description: "하나의 프로세스 안에서 여러 스레드를 동시에 또는 병행적으로 실행하는 방식입니다.",
        relatedKeys: ["thread", "concurrency", "parallelism"],
        keywords: ["multithreading", "멀티스레딩", "동시성"],
      },
      {
        key: "pcb",
        label: "PCB",
        description: "Process Control Block의 약자로, 프로세스 상태, 레지스터 값, 프로그램 카운터, 스케줄링 정보 등을 저장합니다.",
        relatedKeys: ["process", "context-switching", "process-state"],
        keywords: ["PCB", "process control block", "프로세스 제어 블록"],
      },
      {
        key: "tcb",
        label: "TCB",
        description: "Thread Control Block의 약자로, 스레드의 실행 상태와 레지스터 정보를 저장하는 자료구조입니다.",
        relatedKeys: ["thread", "pcb", "context-switching"],
        keywords: ["TCB", "thread control block", "스레드 제어 블록"],
      },
      {
        key: "process-state",
        label: "프로세스 상태",
        description: "프로세스가 생성, 준비, 실행, 대기, 종료 같은 실행 생명주기 중 어느 단계에 있는지를 나타냅니다.",
        relatedKeys: ["new-state", "ready-state", "running-state", "waiting-state", "terminated-state"],
        keywords: ["process state", "프로세스 상태", "ready", "running"],
      },
      {
        key: "new-state",
        label: "생성 상태",
        description: "프로세스가 생성되고 있지만 아직 실행 준비가 완료되지 않은 상태입니다.",
        relatedKeys: ["process-state", "ready-state"],
        keywords: ["new state", "생성 상태", "프로세스 생성"],
      },
      {
        key: "ready-state",
        label: "준비 상태",
        description: "프로세스가 CPU를 할당받기 위해 준비 큐에서 기다리는 상태입니다.",
        relatedKeys: ["process-state", "ready-queue", "scheduler"],
        keywords: ["ready", "준비 상태", "ready queue"],
      },
      {
        key: "running-state",
        label: "실행 상태",
        description: "프로세스가 CPU를 할당받아 명령어를 실행 중인 상태입니다.",
        relatedKeys: ["process-state", "cpu", "dispatcher"],
        keywords: ["running", "실행 상태", "CPU 실행"],
      },
      {
        key: "waiting-state",
        label: "대기 상태",
        description: "프로세스가 입출력 완료나 특정 이벤트 발생을 기다리는 상태입니다.",
        relatedKeys: ["process-state", "io-wait", "blocked-state"],
        keywords: ["waiting", "대기 상태", "blocked"],
      },
      {
        key: "blocked-state",
        label: "블록 상태",
        description: "프로세스가 자원이나 이벤트를 기다리느라 CPU를 사용할 수 없는 상태입니다.",
        relatedKeys: ["waiting-state", "io-wait", "process-state"],
        keywords: ["blocked", "블록 상태", "대기"],
      },
      {
        key: "terminated-state",
        label: "종료 상태",
        description: "프로세스 실행이 끝나고 운영체제가 자원을 회수하는 상태입니다.",
        relatedKeys: ["process-state", "exit", "zombie-process"],
        keywords: ["terminated", "종료 상태", "exit"],
      },
      {
        key: "context-switching",
        label: "문맥 교환",
        description: "CPU가 실행 대상을 바꿀 때 현재 프로세스나 스레드의 상태를 저장하고 다음 실행 상태를 복원하는 작업입니다.",
        relatedKeys: ["pcb", "tcb", "scheduler", "overhead"],
        keywords: ["context switching", "문맥 교환", "상태 저장", "오버헤드"],
      },
      {
        key: "overhead",
        label: "오버헤드",
        description: "실제 작업 수행 외에 관리나 전환을 위해 추가로 발생하는 시간, 메모리, 처리 비용입니다.",
        relatedKeys: ["context-switching", "system-call", "scheduling"],
        keywords: ["overhead", "오버헤드", "추가 비용"],
      },
      {
        key: "fork",
        label: "fork",
        description: "Unix 계열 운영체제에서 현재 프로세스를 복제해 자식 프로세스를 생성하는 시스템 콜입니다.",
        relatedKeys: ["process", "exec", "parent-process", "child-process"],
        keywords: ["fork", "프로세스 복제", "자식 프로세스"],
      },
      {
        key: "exec",
        label: "exec",
        description: "현재 프로세스의 주소 공간을 새로운 프로그램 이미지로 교체해 실행하는 시스템 콜입니다.",
        relatedKeys: ["fork", "process", "loader"],
        keywords: ["exec", "프로그램 실행", "주소 공간 교체"],
      },
      {
        key: "parent-process",
        label: "부모 프로세스",
        description: "다른 프로세스를 생성한 원래 프로세스입니다.",
        relatedKeys: ["child-process", "fork", "process"],
        keywords: ["parent process", "부모 프로세스"],
      },
      {
        key: "child-process",
        label: "자식 프로세스",
        description: "부모 프로세스에 의해 생성된 프로세스입니다.",
        relatedKeys: ["parent-process", "fork", "process"],
        keywords: ["child process", "자식 프로세스"],
      },
      {
        key: "zombie-process",
        label: "좀비 프로세스",
        description: "실행은 종료되었지만 부모 프로세스가 종료 상태를 회수하지 않아 PCB 일부가 남아 있는 프로세스입니다.",
        relatedKeys: ["terminated-state", "wait-system-call", "process"],
        keywords: ["zombie", "좀비 프로세스", "종료 상태 미회수"],
      },
      {
        key: "orphan-process",
        label: "고아 프로세스",
        description: "부모 프로세스가 먼저 종료되어 다른 시스템 프로세스에 의해 관리되는 프로세스입니다.",
        relatedKeys: ["parent-process", "child-process", "process"],
        keywords: ["orphan process", "고아 프로세스"],
      },
      {
        key: "wait-system-call",
        label: "wait 시스템 콜",
        description: "부모 프로세스가 자식 프로세스의 종료를 기다리고 종료 상태를 회수하는 시스템 콜입니다.",
        relatedKeys: ["zombie-process", "parent-process", "child-process"],
        keywords: ["wait", "wait system call", "종료 상태 회수"],
      },

      {
        key: "cpu-scheduling",
        label: "CPU 스케줄링",
        description: "여러 프로세스나 스레드 중 어떤 작업에 CPU를 할당할지 결정하는 운영체제 기능입니다.",
        relatedKeys: ["scheduler", "ready-queue", "dispatch"],
        keywords: ["CPU scheduling", "CPU 스케줄링", "스케줄러"],
      },
      {
        key: "scheduler",
        label: "스케줄러",
        description: "준비 큐에 있는 작업 중 다음에 CPU를 사용할 작업을 선택하는 운영체제 구성 요소입니다.",
        relatedKeys: ["cpu-scheduling", "dispatcher", "ready-queue"],
        keywords: ["scheduler", "스케줄러", "작업 선택"],
      },
      {
        key: "dispatcher",
        label: "디스패처",
        description: "스케줄러가 선택한 프로세스에 실제로 CPU 제어권을 넘기는 역할을 합니다.",
        relatedKeys: ["scheduler", "context-switching", "dispatch-latency"],
        keywords: ["dispatcher", "디스패처", "CPU 전달"],
      },
      {
        key: "dispatch-latency",
        label: "디스패치 지연",
        description: "한 프로세스를 중단하고 다른 프로세스가 CPU를 사용하기 시작할 때까지 걸리는 시간입니다.",
        relatedKeys: ["dispatcher", "context-switching", "overhead"],
        keywords: ["dispatch latency", "디스패치 지연", "전환 시간"],
      },
      {
        key: "ready-queue",
        label: "준비 큐",
        description: "CPU를 할당받기 위해 기다리는 준비 상태의 프로세스들이 저장되는 큐입니다.",
        relatedKeys: ["ready-state", "scheduler", "cpu-scheduling"],
        keywords: ["ready queue", "준비 큐", "CPU 대기"],
      },
      {
        key: "preemptive-scheduling",
        label: "선점형 스케줄링",
        description: "운영체제가 실행 중인 프로세스의 CPU를 강제로 회수해 다른 프로세스에 배정할 수 있는 스케줄링 방식입니다.",
        relatedKeys: ["nonpreemptive-scheduling", "round-robin", "priority-scheduling"],
        keywords: ["preemptive", "선점형", "CPU 회수"],
      },
      {
        key: "nonpreemptive-scheduling",
        label: "비선점형 스케줄링",
        description: "실행 중인 프로세스가 CPU를 자발적으로 반납할 때까지 계속 실행되는 스케줄링 방식입니다.",
        relatedKeys: ["preemptive-scheduling", "fcfs", "sjf"],
        keywords: ["nonpreemptive", "비선점형", "CPU 비회수"],
      },
      {
        key: "fcfs",
        label: "FCFS",
        description: "First-Come, First-Served 방식으로 먼저 도착한 프로세스를 먼저 실행하는 스케줄링 알고리즘입니다.",
        relatedKeys: ["cpu-scheduling", "convoy-effect", "nonpreemptive-scheduling"],
        keywords: ["FCFS", "first come first served", "도착 순서"],
      },
      {
        key: "convoy-effect",
        label: "호위 효과",
        description: "긴 작업이 CPU를 오래 차지해 뒤따르는 짧은 작업들이 오래 기다리는 FCFS의 문제입니다.",
        relatedKeys: ["fcfs", "waiting-time", "cpu-scheduling"],
        keywords: ["convoy effect", "호위 효과", "긴 작업"],
      },
      {
        key: "sjf",
        label: "SJF",
        description: "Shortest Job First 방식으로 실행 시간이 가장 짧은 작업을 먼저 선택하는 스케줄링 알고리즘입니다.",
        relatedKeys: ["srtf", "starvation", "waiting-time"],
        keywords: ["SJF", "shortest job first", "짧은 작업 우선"],
      },
      {
        key: "srtf",
        label: "SRTF",
        description: "Shortest Remaining Time First 방식으로 남은 실행 시간이 가장 짧은 작업을 우선 실행하는 선점형 SJF입니다.",
        relatedKeys: ["sjf", "preemptive-scheduling", "remaining-time"],
        keywords: ["SRTF", "shortest remaining time", "남은 시간"],
      },
      {
        key: "round-robin",
        label: "Round Robin",
        description: "각 프로세스에 시간 할당량을 주고 순환하며 CPU를 배분하는 선점형 스케줄링 방식입니다.",
        relatedKeys: ["time-quantum", "preemptive-scheduling", "response-time"],
        keywords: ["round robin", "라운드 로빈", "시간 할당량"],
      },
      {
        key: "time-quantum",
        label: "Time Quantum",
        description: "Round Robin에서 각 프로세스가 한 번에 CPU를 사용할 수 있는 최대 시간 단위입니다.",
        relatedKeys: ["round-robin", "context-switching", "response-time"],
        keywords: ["time quantum", "시간 할당량", "타임 슬라이스"],
      },
      {
        key: "priority-scheduling",
        label: "우선순위 스케줄링",
        description: "프로세스에 부여된 우선순위를 기준으로 CPU를 배정하는 스케줄링 방식입니다.",
        relatedKeys: ["starvation", "aging", "preemptive-scheduling"],
        keywords: ["priority scheduling", "우선순위 스케줄링", "priority"],
      },
      {
        key: "starvation",
        label: "기아 현상",
        description: "특정 프로세스가 자원이나 CPU를 계속 배정받지 못하고 오래 기다리는 현상입니다.",
        relatedKeys: ["priority-scheduling", "aging", "sjf"],
        keywords: ["starvation", "기아 현상", "무한 대기"],
      },
      {
        key: "aging",
        label: "에이징 기법",
        description: "오래 기다린 프로세스의 우선순위를 점진적으로 높여 기아 현상을 줄이는 방식입니다.",
        relatedKeys: ["starvation", "priority-scheduling"],
        keywords: ["aging", "에이징", "우선순위 증가"],
      },
      {
        key: "multilevel-queue",
        label: "다단계 큐 스케줄링",
        description: "프로세스를 성격에 따라 여러 큐로 나누고 각 큐에 다른 스케줄링 정책을 적용하는 방식입니다.",
        relatedKeys: ["multilevel-feedback-queue", "cpu-scheduling"],
        keywords: ["multilevel queue", "다단계 큐", "큐 분리"],
      },
      {
        key: "multilevel-feedback-queue",
        label: "다단계 피드백 큐",
        description: "프로세스의 실행 특성에 따라 큐 사이를 이동시키며 CPU를 배정하는 적응형 스케줄링 방식입니다.",
        relatedKeys: ["multilevel-queue", "aging", "round-robin"],
        keywords: ["MLFQ", "다단계 피드백 큐", "적응형 스케줄링"],
      },
      {
        key: "lottery",
        label: "Lottery Scheduling",
        description: "티켓을 많이 가진 프로세스가 CPU를 배정받을 확률이 높아지는 확률 기반 공정 배분 방식입니다.",
        relatedKeys: ["stride", "fairness", "ticket"],
        keywords: ["lottery", "티켓", "확률", "무작위"],
      },
      {
        key: "ticket",
        label: "Ticket",
        description: "Lottery Scheduling이나 Stride Scheduling에서 CPU 몫을 표현하기 위해 사용하는 추상적 권한 단위입니다.",
        relatedKeys: ["lottery", "stride", "fairness"],
        keywords: ["ticket", "티켓", "CPU 몫", "권한"],
      },
      {
        key: "stride",
        label: "Stride Scheduling",
        description: "티켓 수로 stride를 계산하고 pass 값이 가장 작은 프로세스를 실행하는 결정적 공정 배분 방식입니다.",
        relatedKeys: ["lottery", "pass", "ticket"],
        keywords: ["stride", "pass", "ticket", "결정적"],
      },
      {
        key: "pass",
        label: "pass 값",
        description: "Stride Scheduling에서 누가 다음에 실행될지 결정하는 누적 값이며, 실행된 프로세스는 pass에 stride를 더합니다.",
        relatedKeys: ["stride", "fairness"],
        keywords: ["pass", "stride 계산", "실행 순서"],
      },
      {
        key: "cfs",
        label: "Linux CFS",
        description: "Linux에서 사용하는 공정 스케줄러로, vruntime이 가장 작은 프로세스를 선택해 공정성과 성능 균형을 맞춥니다.",
        relatedKeys: ["vruntime", "fairness", "red-black-tree"],
        keywords: ["cfs", "linux", "vruntime", "공정 스케줄러"],
      },
      {
        key: "vruntime",
        label: "vruntime / weight",
        description: "CFS에서 weight가 큰 프로세스는 vruntime이 상대적으로 느리게 증가해 더 많은 CPU 몫을 받을 수 있습니다.",
        relatedKeys: ["cfs", "fairness", "nice"],
        keywords: ["vruntime", "weight", "nice", "niceness"],
      },
      {
        key: "nice",
        label: "nice 값",
        description: "Linux에서 프로세스의 상대적 우선순위와 CPU 배분 비율에 영향을 주는 값입니다.",
        relatedKeys: ["vruntime", "cfs", "priority-scheduling"],
        keywords: ["nice", "niceness", "우선순위", "Linux"],
      },
      {
        key: "fairness",
        label: "공정성 균형",
        description: "여러 작업이 CPU나 자원을 얼마나 공평하게 배정받는지를 평가하는 관점입니다.",
        relatedKeys: ["lottery", "stride", "cfs", "vruntime"],
        keywords: ["공정성", "성능", "비교", "균형"],
      },
      {
        key: "turnaround-time",
        label: "반환 시간",
        description: "프로세스가 도착한 시점부터 실행을 완료할 때까지 걸린 전체 시간입니다.",
        relatedKeys: ["waiting-time", "response-time", "cpu-scheduling"],
        keywords: ["turnaround time", "반환 시간", "완료 시간"],
      },
      {
        key: "waiting-time",
        label: "대기 시간",
        description: "프로세스가 준비 큐에서 CPU를 기다린 총 시간입니다.",
        relatedKeys: ["turnaround-time", "response-time", "ready-queue"],
        keywords: ["waiting time", "대기 시간", "준비 큐"],
      },
      {
        key: "response-time",
        label: "응답 시간",
        description: "프로세스가 도착한 뒤 처음으로 CPU를 할당받기까지 걸린 시간입니다.",
        relatedKeys: ["round-robin", "waiting-time", "turnaround-time"],
        keywords: ["response time", "응답 시간", "첫 실행"],
      },
      {
        key: "throughput",
        label: "처리량",
        description: "단위 시간 동안 완료되는 프로세스나 작업의 수입니다.",
        relatedKeys: ["cpu-utilization", "cpu-scheduling", "performance"],
        keywords: ["throughput", "처리량", "완료 작업 수"],
      },
      {
        key: "cpu-utilization",
        label: "CPU 이용률",
        description: "CPU가 실제 작업을 수행하며 사용된 시간의 비율입니다.",
        relatedKeys: ["throughput", "idle-time", "scheduling"],
        keywords: ["CPU utilization", "CPU 이용률", "사용률"],
      },

      {
        key: "concurrency",
        label: "동시성",
        description: "여러 작업이 논리적으로 동시에 진행되는 것처럼 실행되는 성질입니다.",
        relatedKeys: ["parallelism", "thread", "synchronization"],
        keywords: ["concurrency", "동시성", "병행 실행"],
      },
      {
        key: "parallelism",
        label: "병렬성",
        description: "여러 작업이 실제로 여러 CPU나 코어에서 동시에 실행되는 성질입니다.",
        relatedKeys: ["concurrency", "multicore", "thread"],
        keywords: ["parallelism", "병렬성", "동시 실행"],
      },
      {
        key: "critical-section",
        label: "임계 구역",
        description: "공유 자원에 접근하는 코드 영역으로, 동시에 여러 스레드가 진입하면 문제가 발생할 수 있습니다.",
        relatedKeys: ["race-condition", "mutex", "semaphore"],
        keywords: ["critical section", "임계 구역", "공유 자원"],
      },
      {
        key: "race-condition",
        label: "경쟁 상태",
        description: "여러 스레드나 프로세스의 실행 순서에 따라 결과가 달라지는 오류 상황입니다.",
        relatedKeys: ["critical-section", "synchronization", "mutex"],
        keywords: ["race condition", "경쟁 상태", "실행 순서"],
      },
      {
        key: "synchronization",
        label: "동기화",
        description: "여러 프로세스나 스레드가 공유 자원에 안전하게 접근하도록 실행 순서를 조정하는 기법입니다.",
        relatedKeys: ["critical-section", "mutex", "semaphore"],
        keywords: ["synchronization", "동기화", "공유 자원"],
      },
      {
        key: "mutex",
        label: "Mutex",
        description: "한 번에 하나의 스레드만 임계 구역에 진입하도록 보장하는 상호 배제 도구입니다.",
        relatedKeys: ["critical-section", "lock", "semaphore"],
        keywords: ["mutex", "뮤텍스", "상호 배제"],
      },
      {
        key: "lock",
        label: "Lock",
        description: "공유 자원을 사용할 때 다른 실행 흐름의 접근을 막기 위해 사용하는 동기화 도구입니다.",
        relatedKeys: ["mutex", "spinlock", "critical-section"],
        keywords: ["lock", "락", "잠금"],
      },
      {
        key: "spinlock",
        label: "Spinlock",
        description: "락을 얻을 때까지 CPU를 점유하며 반복적으로 확인하는 동기화 방식입니다.",
        relatedKeys: ["lock", "busy-waiting", "mutex"],
        keywords: ["spinlock", "스핀락", "busy waiting"],
      },
      {
        key: "busy-waiting",
        label: "바쁜 대기",
        description: "조건이 만족될 때까지 CPU를 계속 사용하며 반복적으로 확인하는 대기 방식입니다.",
        relatedKeys: ["spinlock", "semaphore", "cpu-utilization"],
        keywords: ["busy waiting", "바쁜 대기", "CPU 낭비"],
      },
      {
        key: "semaphore",
        label: "세마포어",
        description: "정수 값을 이용해 여러 프로세스나 스레드의 자원 접근 개수를 제어하는 동기화 도구입니다.",
        relatedKeys: ["binary-semaphore", "counting-semaphore", "mutex"],
        keywords: ["semaphore", "세마포어", "동기화"],
      },
      {
        key: "binary-semaphore",
        label: "이진 세마포어",
        description: "값이 0 또는 1만 될 수 있는 세마포어로, 뮤텍스와 비슷하게 상호 배제에 사용할 수 있습니다.",
        relatedKeys: ["semaphore", "mutex", "critical-section"],
        keywords: ["binary semaphore", "이진 세마포어", "0과 1"],
      },
      {
        key: "counting-semaphore",
        label: "카운팅 세마포어",
        description: "여러 개의 동일한 자원에 대한 접근 가능 개수를 제어하는 세마포어입니다.",
        relatedKeys: ["semaphore", "resource-allocation"],
        keywords: ["counting semaphore", "카운팅 세마포어", "자원 개수"],
      },
      {
        key: "monitor",
        label: "모니터",
        description: "공유 데이터와 그 데이터를 다루는 연산을 묶고, 내부에서 상호 배제를 보장하는 고수준 동기화 구조입니다.",
        relatedKeys: ["condition-variable", "mutex", "synchronization"],
        keywords: ["monitor", "모니터", "고수준 동기화"],
      },
      {
        key: "condition-variable",
        label: "조건 변수",
        description: "모니터나 락과 함께 사용되며 특정 조건이 만족될 때까지 스레드를 기다리게 하는 동기화 도구입니다.",
        relatedKeys: ["monitor", "wait", "signal"],
        keywords: ["condition variable", "조건 변수", "wait", "signal"],
      },
      {
        key: "producer-consumer",
        label: "생산자-소비자 문제",
        description: "생산자가 버퍼에 데이터를 넣고 소비자가 꺼내는 상황에서 동기화와 버퍼 관리를 다루는 고전적 문제입니다.",
        relatedKeys: ["bounded-buffer", "semaphore", "mutex"],
        keywords: ["producer consumer", "생산자 소비자", "버퍼"],
      },
      {
        key: "bounded-buffer",
        label: "유한 버퍼 문제",
        description: "크기가 제한된 버퍼를 여러 생산자와 소비자가 안전하게 공유하도록 동기화하는 문제입니다.",
        relatedKeys: ["producer-consumer", "semaphore", "condition-variable"],
        keywords: ["bounded buffer", "유한 버퍼", "공유 버퍼"],
      },
      {
        key: "readers-writers",
        label: "Readers-Writers 문제",
        description: "여러 읽기 작업은 동시에 허용하되 쓰기 작업은 배타적으로 처리해야 하는 동기화 문제입니다.",
        relatedKeys: ["synchronization", "mutex", "semaphore"],
        keywords: ["readers writers", "읽기 쓰기 문제", "공유 데이터"],
      },
      {
        key: "dining-philosophers",
        label: "식사하는 철학자 문제",
        description: "여러 프로세스가 제한된 자원을 공유할 때 교착 상태와 기아 현상을 설명하는 고전적 동기화 문제입니다.",
        relatedKeys: ["deadlock", "starvation", "synchronization"],
        keywords: ["dining philosophers", "식사하는 철학자", "교착 상태"],
      },

      {
        key: "deadlock",
        label: "교착 상태",
        description: "여러 프로세스가 서로가 가진 자원을 기다리며 더 이상 진행하지 못하는 상태입니다.",
        relatedKeys: ["mutual-exclusion", "hold-and-wait", "no-preemption", "circular-wait"],
        keywords: ["deadlock", "교착 상태", "자원 대기"],
      },
      {
        key: "mutual-exclusion",
        label: "상호 배제",
        description: "하나의 자원을 한 번에 하나의 프로세스나 스레드만 사용할 수 있는 조건입니다.",
        relatedKeys: ["deadlock", "critical-section", "mutex"],
        keywords: ["mutual exclusion", "상호 배제", "독점 사용"],
      },
      {
        key: "hold-and-wait",
        label: "점유와 대기",
        description: "프로세스가 이미 자원을 가진 상태에서 다른 자원을 추가로 기다리는 교착 상태 발생 조건입니다.",
        relatedKeys: ["deadlock", "resource-allocation"],
        keywords: ["hold and wait", "점유와 대기", "자원 대기"],
      },
      {
        key: "no-preemption",
        label: "비선점 조건",
        description: "이미 할당된 자원을 운영체제가 강제로 빼앗을 수 없다는 교착 상태 발생 조건입니다.",
        relatedKeys: ["deadlock", "preemption", "resource-allocation"],
        keywords: ["no preemption", "비선점", "자원 회수 불가"],
      },
      {
        key: "circular-wait",
        label: "순환 대기",
        description: "프로세스들이 원형으로 서로가 가진 자원을 기다리는 교착 상태 발생 조건입니다.",
        relatedKeys: ["deadlock", "resource-allocation-graph"],
        keywords: ["circular wait", "순환 대기", "원형 대기"],
      },
      {
        key: "deadlock-prevention",
        label: "교착 상태 예방",
        description: "교착 상태의 네 가지 필요 조건 중 하나 이상이 성립하지 않도록 시스템을 설계하는 방식입니다.",
        relatedKeys: ["deadlock", "mutual-exclusion", "circular-wait"],
        keywords: ["deadlock prevention", "교착 상태 예방", "필요 조건 차단"],
      },
      {
        key: "deadlock-avoidance",
        label: "교착 상태 회피",
        description: "자원 할당 전 시스템이 안전 상태를 유지할 수 있는지 검사해 교착 상태를 피하는 방식입니다.",
        relatedKeys: ["bankers-algorithm", "safe-state", "deadlock"],
        keywords: ["deadlock avoidance", "교착 상태 회피", "안전 상태"],
      },
      {
        key: "deadlock-detection",
        label: "교착 상태 탐지",
        description: "시스템 실행 중 교착 상태가 발생했는지 검사하는 방식입니다.",
        relatedKeys: ["deadlock-recovery", "resource-allocation-graph"],
        keywords: ["deadlock detection", "교착 상태 탐지", "검사"],
      },
      {
        key: "deadlock-recovery",
        label: "교착 상태 복구",
        description: "교착 상태가 발견된 후 프로세스 종료나 자원 선점 등을 통해 시스템을 정상 상태로 되돌리는 방식입니다.",
        relatedKeys: ["deadlock-detection", "deadlock"],
        keywords: ["deadlock recovery", "교착 상태 복구", "프로세스 종료"],
      },
      {
        key: "bankers-algorithm",
        label: "은행가 알고리즘",
        description: "자원 요청을 승인했을 때 시스템이 안전 상태에 남는지 확인해 교착 상태를 회피하는 알고리즘입니다.",
        relatedKeys: ["deadlock-avoidance", "safe-state", "resource-allocation"],
        keywords: ["banker's algorithm", "은행가 알고리즘", "안전 상태"],
      },
      {
        key: "safe-state",
        label: "안전 상태",
        description: "모든 프로세스가 어떤 순서로든 필요한 자원을 할당받아 정상 종료될 수 있는 상태입니다.",
        relatedKeys: ["bankers-algorithm", "deadlock-avoidance"],
        keywords: ["safe state", "안전 상태", "safe sequence"],
      },
      {
        key: "resource-allocation-graph",
        label: "자원 할당 그래프",
        description: "프로세스와 자원 사이의 할당 및 요청 관계를 그래프로 표현해 교착 상태를 분석하는 방법입니다.",
        relatedKeys: ["deadlock", "circular-wait", "deadlock-detection"],
        keywords: ["resource allocation graph", "자원 할당 그래프", "교착 상태"],
      },

      {
        key: "memory-management",
        label: "메모리 관리",
        description: "운영체제가 주기억장치를 할당, 회수, 보호, 공유하는 기능입니다.",
        relatedKeys: ["virtual-memory", "paging", "segmentation"],
        keywords: ["memory management", "메모리 관리", "주기억장치"],
      },
      {
        key: "address-space",
        label: "주소 공간",
        description: "프로세스가 사용할 수 있다고 인식하는 메모리 주소의 범위입니다.",
        relatedKeys: ["logical-address", "physical-address", "virtual-memory"],
        keywords: ["address space", "주소 공간", "메모리 주소"],
      },
      {
        key: "logical-address",
        label: "논리 주소",
        description: "CPU가 생성하는 주소로, 프로세스 관점에서 사용하는 가상적인 주소입니다.",
        relatedKeys: ["physical-address", "mmu", "virtual-memory"],
        keywords: ["logical address", "논리 주소", "가상 주소"],
      },
      {
        key: "physical-address",
        label: "물리 주소",
        description: "실제 메모리 하드웨어에서 사용되는 주소입니다.",
        relatedKeys: ["logical-address", "mmu", "main-memory"],
        keywords: ["physical address", "물리 주소", "실제 메모리"],
      },
      {
        key: "mmu",
        label: "MMU",
        description: "Memory Management Unit의 약자로, 논리 주소를 물리 주소로 변환하는 하드웨어 장치입니다.",
        relatedKeys: ["logical-address", "physical-address", "tlb"],
        keywords: ["MMU", "주소 변환", "memory management unit"],
      },
      {
        key: "base-limit-register",
        label: "Base/Limit Register",
        description: "프로세스의 메모리 접근 범위를 제한하고 보호하기 위해 사용하는 기준 주소와 한계 레지스터입니다.",
        relatedKeys: ["memory-protection", "relocation", "address-space"],
        keywords: ["base register", "limit register", "메모리 보호"],
      },
      {
        key: "memory-protection",
        label: "메모리 보호",
        description: "프로세스가 허용되지 않은 메모리 영역에 접근하지 못하도록 막는 기능입니다.",
        relatedKeys: ["base-limit-register", "segmentation-fault", "protection"],
        keywords: ["memory protection", "메모리 보호", "접근 제한"],
      },
      {
        key: "contiguous-allocation",
        label: "연속 메모리 할당",
        description: "프로세스에 필요한 메모리를 하나의 연속된 물리 메모리 공간으로 할당하는 방식입니다.",
        relatedKeys: ["fragmentation", "fixed-partition", "dynamic-partition"],
        keywords: ["contiguous allocation", "연속 할당", "메모리 할당"],
      },
      {
        key: "fixed-partition",
        label: "고정 분할",
        description: "메모리를 미리 정해진 크기의 여러 구역으로 나누어 프로세스에 할당하는 방식입니다.",
        relatedKeys: ["contiguous-allocation", "internal-fragmentation"],
        keywords: ["fixed partition", "고정 분할", "내부 단편화"],
      },
      {
        key: "dynamic-partition",
        label: "가변 분할",
        description: "프로세스 크기에 맞춰 메모리 구역을 동적으로 나누어 할당하는 방식입니다.",
        relatedKeys: ["contiguous-allocation", "external-fragmentation"],
        keywords: ["dynamic partition", "가변 분할", "외부 단편화"],
      },
      {
        key: "fragmentation",
        label: "단편화",
        description: "메모리 공간이 비효율적으로 나뉘어 사용 가능한 공간이 낭비되는 현상입니다.",
        relatedKeys: ["internal-fragmentation", "external-fragmentation", "compaction"],
        keywords: ["fragmentation", "단편화", "메모리 낭비"],
      },
      {
        key: "internal-fragmentation",
        label: "내부 단편화",
        description: "할당된 메모리 블록 내부에서 실제로 사용되지 않는 공간이 낭비되는 현상입니다.",
        relatedKeys: ["fragmentation", "paging", "fixed-partition"],
        keywords: ["internal fragmentation", "내부 단편화", "블록 내부 낭비"],
      },
      {
        key: "external-fragmentation",
        label: "외부 단편화",
        description: "총 여유 메모리는 충분하지만 여러 작은 조각으로 흩어져 큰 요청을 처리하지 못하는 현상입니다.",
        relatedKeys: ["fragmentation", "compaction", "dynamic-partition"],
        keywords: ["external fragmentation", "외부 단편화", "흩어진 공간"],
      },
      {
        key: "compaction",
        label: "압축",
        description: "흩어진 빈 메모리 공간을 한쪽으로 모아 외부 단편화를 줄이는 작업입니다.",
        relatedKeys: ["external-fragmentation", "relocation", "memory-management"],
        keywords: ["compaction", "압축", "외부 단편화"],
      },
      {
        key: "paging",
        label: "페이징",
        description: "논리 메모리를 페이지 단위로, 물리 메모리를 프레임 단위로 나누어 매핑하는 메모리 관리 방식입니다.",
        relatedKeys: ["page", "frame", "page-table", "virtual-memory"],
        keywords: ["paging", "페이징", "페이지", "프레임"],
      },
      {
        key: "page",
        label: "페이지",
        description: "가상 주소 공간을 고정 크기로 나눈 단위입니다.",
        relatedKeys: ["paging", "frame", "page-table"],
        keywords: ["page", "페이지", "가상 메모리 단위"],
      },
      {
        key: "frame",
        label: "프레임",
        description: "물리 메모리를 페이지와 같은 크기로 나눈 단위입니다.",
        relatedKeys: ["page", "paging", "main-memory"],
        keywords: ["frame", "프레임", "물리 메모리 단위"],
      },
      {
        key: "page-table",
        label: "페이지 테이블",
        description: "가상 페이지 번호를 물리 프레임 번호로 변환하기 위한 매핑 정보를 저장하는 자료구조입니다.",
        relatedKeys: ["paging", "pte", "tlb"],
        keywords: ["page table", "페이지 테이블", "주소 변환"],
      },
      {
        key: "pte",
        label: "PTE",
        description: "Page Table Entry의 약자로, 하나의 페이지에 대한 프레임 번호와 접근 권한 등의 정보를 담습니다.",
        relatedKeys: ["page-table", "valid-bit", "dirty-bit"],
        keywords: ["PTE", "page table entry", "페이지 테이블 엔트리"],
      },
      {
        key: "valid-bit",
        label: "Valid Bit",
        description: "페이지 테이블 엔트리가 유효한 매핑을 가지고 있는지 나타내는 비트입니다.",
        relatedKeys: ["pte", "page-fault", "page-table"],
        keywords: ["valid bit", "유효 비트", "페이지 테이블"],
      },
      {
        key: "dirty-bit",
        label: "Dirty Bit",
        description: "페이지가 메모리에 올라온 뒤 수정되었는지를 나타내며, 교체 시 디스크에 다시 써야 하는지 판단합니다.",
        relatedKeys: ["pte", "page-replacement", "write-back"],
        keywords: ["dirty bit", "수정 비트", "write back"],
      },
      {
        key: "tlb",
        label: "TLB",
        description: "최근 사용한 페이지 테이블 매핑을 저장해 주소 변환 속도를 높이는 캐시입니다.",
        relatedKeys: ["page-table", "mmu", "tlb-hit", "tlb-miss"],
        keywords: ["TLB", "translation lookaside buffer", "주소 변환 캐시"],
      },
      {
        key: "tlb-hit",
        label: "TLB Hit",
        description: "주소 변환에 필요한 페이지 테이블 매핑이 TLB에 있어 빠르게 변환되는 경우입니다.",
        relatedKeys: ["tlb", "tlb-miss", "paging"],
        keywords: ["TLB hit", "TLB 적중", "주소 변환"],
      },
      {
        key: "tlb-miss",
        label: "TLB Miss",
        description: "필요한 주소 변환 정보가 TLB에 없어 페이지 테이블을 추가로 조회해야 하는 경우입니다.",
        relatedKeys: ["tlb", "tlb-hit", "page-table"],
        keywords: ["TLB miss", "TLB 미스", "페이지 테이블 조회"],
      },
      {
        key: "segmentation",
        label: "세그멘테이션",
        description: "프로그램을 코드, 데이터, 스택처럼 논리적 의미 단위인 세그먼트로 나누어 관리하는 메모리 기법입니다.",
        relatedKeys: ["segment", "segmentation-fault", "memory-protection"],
        keywords: ["segmentation", "세그멘테이션", "논리 단위"],
      },
      {
        key: "segment",
        label: "세그먼트",
        description: "코드, 데이터, 스택처럼 논리적 의미를 가진 메모리 영역 단위입니다.",
        relatedKeys: ["segmentation", "address-space"],
        keywords: ["segment", "세그먼트", "논리 영역"],
      },
      {
        key: "segmentation-fault",
        label: "세그멘테이션 오류",
        description: "프로세스가 허용되지 않은 메모리 영역에 접근했을 때 발생하는 오류입니다.",
        relatedKeys: ["segmentation", "memory-protection", "exception"],
        keywords: ["segmentation fault", "세그멘테이션 오류", "잘못된 접근"],
      },
      {
        key: "virtual-memory",
        label: "가상 메모리",
        description: "프로세스가 실제 물리 메모리보다 큰 논리 주소 공간을 사용하는 것처럼 보이게 하는 메모리 관리 기법입니다.",
        relatedKeys: ["paging", "page-fault", "demand-paging"],
        keywords: ["virtual memory", "가상 메모리", "논리 주소"],
      },
      {
        key: "demand-paging",
        label: "요구 페이징",
        description: "프로세스 실행에 필요한 페이지를 처음부터 모두 올리지 않고 필요할 때 메모리에 적재하는 방식입니다.",
        relatedKeys: ["virtual-memory", "page-fault", "lazy-loading"],
        keywords: ["demand paging", "요구 페이징", "필요 시 적재"],
      },
      {
        key: "page-fault",
        label: "페이지 폴트",
        description: "프로세스가 접근하려는 페이지가 현재 물리 메모리에 없을 때 발생하는 예외입니다.",
        relatedKeys: ["demand-paging", "page-replacement", "valid-bit"],
        keywords: ["page fault", "페이지 폴트", "메모리 부재"],
      },
      {
        key: "page-replacement",
        label: "페이지 교체",
        description: "메모리가 부족할 때 기존 페이지 중 하나를 내보내고 필요한 새 페이지를 가져오는 작업입니다.",
        relatedKeys: ["page-fault", "fifo-page-replacement", "lru"],
        keywords: ["page replacement", "페이지 교체", "메모리 부족"],
      },
      {
        key: "fifo-page-replacement",
        label: "FIFO 페이지 교체",
        description: "가장 먼저 메모리에 들어온 페이지를 가장 먼저 교체하는 페이지 교체 알고리즘입니다.",
        relatedKeys: ["page-replacement", "beladys-anomaly"],
        keywords: ["FIFO", "페이지 교체", "선입선출"],
      },
      {
        key: "optimal-page-replacement",
        label: "Optimal 페이지 교체",
        description: "앞으로 가장 오랫동안 사용되지 않을 페이지를 교체하는 이론적으로 최적의 페이지 교체 알고리즘입니다.",
        relatedKeys: ["page-replacement", "lru"],
        keywords: ["optimal", "최적 페이지 교체", "미래 참조"],
      },
      {
        key: "lru",
        label: "LRU",
        description: "Least Recently Used 방식으로 가장 오랫동안 사용되지 않은 페이지를 교체하는 알고리즘입니다.",
        relatedKeys: ["page-replacement", "locality", "clock-algorithm"],
        keywords: ["LRU", "least recently used", "최근 미사용"],
      },
      {
        key: "clock-algorithm",
        label: "Clock 알고리즘",
        description: "참조 비트를 이용해 LRU를 근사하는 페이지 교체 알고리즘입니다.",
        relatedKeys: ["lru", "reference-bit", "page-replacement"],
        keywords: ["clock algorithm", "클럭 알고리즘", "참조 비트"],
      },
      {
        key: "reference-bit",
        label: "Reference Bit",
        description: "페이지가 최근에 참조되었는지를 나타내는 비트입니다.",
        relatedKeys: ["clock-algorithm", "pte", "page-replacement"],
        keywords: ["reference bit", "참조 비트", "페이지 교체"],
      },
      {
        key: "beladys-anomaly",
        label: "Belady의 이상 현상",
        description: "FIFO 페이지 교체에서 프레임 수가 늘어났는데도 페이지 폴트가 증가할 수 있는 현상입니다.",
        relatedKeys: ["fifo-page-replacement", "page-replacement"],
        keywords: ["Belady anomaly", "벨라디 이상", "FIFO"],
      },
      {
        key: "thrashing",
        label: "스래싱",
        description: "페이지 폴트가 과도하게 발생해 CPU가 실제 작업보다 페이지 교체에 대부분의 시간을 쓰는 현상입니다.",
        relatedKeys: ["page-fault", "working-set", "virtual-memory"],
        keywords: ["thrashing", "스래싱", "페이지 폴트 과다"],
      },
      {
        key: "working-set",
        label: "Working Set",
        description: "프로세스가 최근 일정 시간 동안 사용한 페이지들의 집합입니다.",
        relatedKeys: ["thrashing", "locality", "virtual-memory"],
        keywords: ["working set", "작업 집합", "최근 페이지"],
      },
      {
        key: "locality",
        label: "지역성",
        description: "프로그램이 특정 시간 동안 제한된 데이터나 명령어 영역을 집중적으로 참조하는 성질입니다.",
        relatedKeys: ["temporal-locality", "spatial-locality", "cache"],
        keywords: ["locality", "지역성", "참조 패턴"],
      },
      {
        key: "temporal-locality",
        label: "시간 지역성",
        description: "최근 참조한 데이터나 명령어가 가까운 미래에 다시 참조될 가능성이 높은 성질입니다.",
        relatedKeys: ["locality", "cache", "lru"],
        keywords: ["temporal locality", "시간 지역성", "재참조"],
      },
      {
        key: "spatial-locality",
        label: "공간 지역성",
        description: "참조한 주소 근처의 데이터나 명령어가 곧 참조될 가능성이 높은 성질입니다.",
        relatedKeys: ["locality", "cache", "page"],
        keywords: ["spatial locality", "공간 지역성", "인접 데이터"],
      },
      {
        key: "swap",
        label: "스왑",
        description: "메모리에 있는 프로세스나 페이지를 디스크의 스왑 영역으로 내보내거나 다시 가져오는 작업입니다.",
        relatedKeys: ["virtual-memory", "swap-space", "page-replacement"],
        keywords: ["swap", "스왑", "디스크 이동"],
      },
      {
        key: "swap-space",
        label: "스왑 공간",
        description: "메모리 부족 시 페이지나 프로세스를 임시로 저장하기 위해 사용하는 디스크 영역입니다.",
        relatedKeys: ["swap", "virtual-memory"],
        keywords: ["swap space", "스왑 공간", "디스크 영역"],
      },

      {
        key: "cache",
        label: "캐시",
        description: "자주 사용되거나 곧 사용될 가능성이 높은 데이터를 빠른 저장장치에 임시로 저장하는 구조입니다.",
        relatedKeys: ["locality", "cache-hit", "cache-miss"],
        keywords: ["cache", "캐시", "빠른 저장소"],
      },
      {
        key: "cache-hit",
        label: "Cache Hit",
        description: "필요한 데이터가 캐시에 존재해 빠르게 접근할 수 있는 경우입니다.",
        relatedKeys: ["cache", "cache-miss", "hit-ratio"],
        keywords: ["cache hit", "캐시 적중", "hit"],
      },
      {
        key: "cache-miss",
        label: "Cache Miss",
        description: "필요한 데이터가 캐시에 없어 하위 저장장치에서 가져와야 하는 경우입니다.",
        relatedKeys: ["cache", "cache-hit", "miss-penalty"],
        keywords: ["cache miss", "캐시 미스", "miss"],
      },
      {
        key: "hit-ratio",
        label: "Hit Ratio",
        description: "전체 메모리 접근 중 캐시 적중이 발생한 비율입니다.",
        relatedKeys: ["cache-hit", "cache", "performance"],
        keywords: ["hit ratio", "적중률", "캐시 성능"],
      },
      {
        key: "miss-penalty",
        label: "Miss Penalty",
        description: "캐시 미스가 발생했을 때 데이터를 가져오기 위해 추가로 소요되는 시간입니다.",
        relatedKeys: ["cache-miss", "cache", "performance"],
        keywords: ["miss penalty", "미스 패널티", "추가 지연"],
      },
      {
        key: "write-through",
        label: "Write-Through",
        description: "캐시에 데이터를 쓸 때 하위 저장장치에도 즉시 반영하는 쓰기 정책입니다.",
        relatedKeys: ["write-back", "cache", "dirty-bit"],
        keywords: ["write through", "즉시 쓰기", "캐시 정책"],
      },
      {
        key: "write-back",
        label: "Write-Back",
        description: "캐시에 먼저 쓰고 수정된 블록이 교체될 때 하위 저장장치에 반영하는 쓰기 정책입니다.",
        relatedKeys: ["write-through", "dirty-bit", "cache"],
        keywords: ["write back", "나중 쓰기", "dirty bit"],
      },

      {
        key: "file-system",
        label: "파일 시스템",
        description: "저장장치의 데이터를 파일과 디렉터리 구조로 관리하는 운영체제 구성 요소입니다.",
        relatedKeys: ["file", "directory", "inode"],
        keywords: ["file system", "파일 시스템", "파일", "디렉터리"],
      },
      {
        key: "file",
        label: "파일",
        description: "운영체제가 저장장치에서 데이터를 관리하는 논리적 단위입니다.",
        relatedKeys: ["file-system", "directory", "file-descriptor"],
        keywords: ["file", "파일", "데이터 단위"],
      },
      {
        key: "directory",
        label: "디렉터리",
        description: "파일과 다른 디렉터리를 계층적으로 조직하기 위한 구조입니다.",
        relatedKeys: ["file-system", "path", "inode"],
        keywords: ["directory", "디렉터리", "폴더"],
      },
      {
        key: "path",
        label: "경로",
        description: "파일 시스템에서 특정 파일이나 디렉터리의 위치를 나타내는 문자열입니다.",
        relatedKeys: ["absolute-path", "relative-path", "directory"],
        keywords: ["path", "경로", "파일 위치"],
      },
      {
        key: "absolute-path",
        label: "절대 경로",
        description: "루트 디렉터리부터 시작해 파일이나 디렉터리 위치를 완전하게 표현한 경로입니다.",
        relatedKeys: ["path", "relative-path", "root-directory"],
        keywords: ["absolute path", "절대 경로", "root"],
      },
      {
        key: "relative-path",
        label: "상대 경로",
        description: "현재 디렉터리를 기준으로 파일이나 디렉터리 위치를 표현한 경로입니다.",
        relatedKeys: ["path", "absolute-path", "working-directory"],
        keywords: ["relative path", "상대 경로", "현재 디렉터리"],
      },
      {
        key: "inode",
        label: "inode",
        description: "Unix 계열 파일 시스템에서 파일의 메타데이터와 데이터 블록 위치를 저장하는 자료구조입니다.",
        relatedKeys: ["file-system", "metadata", "directory"],
        keywords: ["inode", "아이노드", "파일 메타데이터"],
      },
      {
        key: "metadata",
        label: "메타데이터",
        description: "파일 이름, 크기, 권한, 생성 시간, 블록 위치처럼 파일 자체를 설명하는 정보입니다.",
        relatedKeys: ["inode", "file-system", "permission"],
        keywords: ["metadata", "메타데이터", "파일 정보"],
      },
      {
        key: "file-descriptor",
        label: "파일 디스크립터",
        description: "프로세스가 열린 파일을 식별하기 위해 사용하는 작은 정수 값입니다.",
        relatedKeys: ["open-system-call", "file", "process"],
        keywords: ["file descriptor", "파일 디스크립터", "fd"],
      },
      {
        key: "open-system-call",
        label: "open 시스템 콜",
        description: "파일을 열고 해당 파일에 접근하기 위한 파일 디스크립터를 반환하는 시스템 콜입니다.",
        relatedKeys: ["file-descriptor", "read-system-call", "write-system-call"],
        keywords: ["open", "시스템 콜", "파일 열기"],
      },
      {
        key: "read-system-call",
        label: "read 시스템 콜",
        description: "파일 디스크립터를 통해 파일이나 장치에서 데이터를 읽는 시스템 콜입니다.",
        relatedKeys: ["file-descriptor", "open-system-call", "write-system-call"],
        keywords: ["read", "시스템 콜", "파일 읽기"],
      },
      {
        key: "write-system-call",
        label: "write 시스템 콜",
        description: "파일 디스크립터를 통해 파일이나 장치에 데이터를 쓰는 시스템 콜입니다.",
        relatedKeys: ["file-descriptor", "open-system-call", "read-system-call"],
        keywords: ["write", "시스템 콜", "파일 쓰기"],
      },
      {
        key: "permission",
        label: "파일 권한",
        description: "파일이나 디렉터리에 대해 읽기, 쓰기, 실행 가능 여부를 제어하는 접근 제어 정보입니다.",
        relatedKeys: ["metadata", "access-control", "file-system"],
        keywords: ["permission", "권한", "read", "write", "execute"],
      },
      {
        key: "access-control",
        label: "접근 제어",
        description: "사용자나 프로세스가 특정 자원에 접근할 수 있는지를 결정하는 보안 기능입니다.",
        relatedKeys: ["permission", "protection", "security"],
        keywords: ["access control", "접근 제어", "보안"],
      },
      {
        key: "mount",
        label: "마운트",
        description: "파일 시스템을 기존 디렉터리 계층의 특정 위치에 연결해 사용할 수 있게 하는 작업입니다.",
        relatedKeys: ["file-system", "mount-point", "directory"],
        keywords: ["mount", "마운트", "파일 시스템 연결"],
      },
      {
        key: "mount-point",
        label: "마운트 포인트",
        description: "다른 파일 시스템이 연결되는 디렉터리 위치입니다.",
        relatedKeys: ["mount", "file-system", "directory"],
        keywords: ["mount point", "마운트 포인트", "연결 위치"],
      },
      {
        key: "journaling",
        label: "저널링",
        description: "파일 시스템 변경 작업을 로그에 먼저 기록해 장애 발생 시 복구 가능성을 높이는 기법입니다.",
        relatedKeys: ["file-system", "crash-consistency", "log-structured-file-system"],
        keywords: ["journaling", "저널링", "복구", "로그"],
      },
      {
        key: "crash-consistency",
        label: "Crash Consistency",
        description: "시스템 충돌 후에도 파일 시스템 구조가 일관된 상태를 유지하도록 보장하는 성질입니다.",
        relatedKeys: ["journaling", "file-system", "recovery"],
        keywords: ["crash consistency", "충돌 일관성", "복구"],
      },

      {
        key: "io-system",
        label: "입출력 시스템",
        description: "운영체제가 디스크, 키보드, 네트워크 카드 같은 입출력 장치를 관리하는 구조입니다.",
        relatedKeys: ["device-driver", "interrupt", "dma"],
        keywords: ["I/O system", "입출력 시스템", "장치 관리"],
      },
      {
        key: "device-driver",
        label: "디바이스 드라이버",
        description: "운영체제가 특정 하드웨어 장치를 제어할 수 있게 해주는 소프트웨어입니다.",
        relatedKeys: ["io-system", "device-controller", "kernel"],
        keywords: ["device driver", "디바이스 드라이버", "장치 제어"],
      },
      {
        key: "device-controller",
        label: "디바이스 컨트롤러",
        description: "CPU와 입출력 장치 사이에서 장치 제어와 데이터 전송을 담당하는 하드웨어 구성 요소입니다.",
        relatedKeys: ["device-driver", "io-system", "interrupt"],
        keywords: ["device controller", "디바이스 컨트롤러", "장치 제어기"],
      },
      {
        key: "dma",
        label: "DMA",
        description: "Direct Memory Access의 약자로, CPU 개입을 줄이고 장치가 메모리와 직접 데이터를 주고받게 하는 방식입니다.",
        relatedKeys: ["io-system", "device-controller", "interrupt"],
        keywords: ["DMA", "direct memory access", "직접 메모리 접근"],
      },
      {
        key: "polling",
        label: "폴링",
        description: "CPU가 장치 상태를 반복적으로 확인해 입출력 완료 여부를 검사하는 방식입니다.",
        relatedKeys: ["interrupt", "busy-waiting", "io-system"],
        keywords: ["polling", "폴링", "상태 확인"],
      },
      {
        key: "buffering",
        label: "버퍼링",
        description: "속도 차이가 있는 장치나 프로세스 사이에서 데이터를 임시 저장해 전송 효율을 높이는 기법입니다.",
        relatedKeys: ["io-system", "spooling", "cache"],
        keywords: ["buffering", "버퍼링", "임시 저장"],
      },
      {
        key: "spooling",
        label: "스풀링",
        description: "느린 입출력 장치에 대한 요청을 디스크 등에 임시 저장해 순차적으로 처리하는 방식입니다.",
        relatedKeys: ["buffering", "io-system", "printer"],
        keywords: ["spooling", "스풀링", "프린터"],
      },
      {
        key: "disk-scheduling",
        label: "디스크 스케줄링",
        description: "디스크 입출력 요청 순서를 조정해 탐색 시간과 응답 시간을 줄이는 기법입니다.",
        relatedKeys: ["fcfs-disk", "sstf", "scan"],
        keywords: ["disk scheduling", "디스크 스케줄링", "I/O 요청"],
      },
      {
        key: "fcfs-disk",
        label: "FCFS 디스크 스케줄링",
        description: "디스크 요청을 도착한 순서대로 처리하는 단순한 디스크 스케줄링 방식입니다.",
        relatedKeys: ["disk-scheduling", "sstf"],
        keywords: ["FCFS disk", "디스크 FCFS", "요청 순서"],
      },
      {
        key: "sstf",
        label: "SSTF",
        description: "Shortest Seek Time First 방식으로 현재 헤드 위치에서 가장 가까운 요청을 먼저 처리합니다.",
        relatedKeys: ["disk-scheduling", "scan", "starvation"],
        keywords: ["SSTF", "shortest seek time", "탐색 시간"],
      },
      {
        key: "scan",
        label: "SCAN",
        description: "디스크 헤드가 한 방향으로 이동하며 요청을 처리하고 끝에 도달하면 방향을 바꾸는 방식입니다.",
        relatedKeys: ["disk-scheduling", "c-scan", "elevator-algorithm"],
        keywords: ["SCAN", "엘리베이터 알고리즘", "디스크 헤드"],
      },
      {
        key: "c-scan",
        label: "C-SCAN",
        description: "디스크 헤드가 한 방향으로만 요청을 처리하고 끝에 도달하면 처음 위치로 돌아가는 방식입니다.",
        relatedKeys: ["scan", "disk-scheduling"],
        keywords: ["C-SCAN", "circular scan", "순환 스캔"],
      },
      {
        key: "elevator-algorithm",
        label: "엘리베이터 알고리즘",
        description: "디스크 헤드가 엘리베이터처럼 한 방향으로 이동하며 요청을 처리하는 SCAN 계열 방식입니다.",
        relatedKeys: ["scan", "disk-scheduling"],
        keywords: ["elevator algorithm", "엘리베이터 알고리즘", "SCAN"],
      },

      {
        key: "booting",
        label: "부팅",
        description: "컴퓨터 전원이 켜진 뒤 운영체제 커널을 메모리에 적재하고 실행 준비를 완료하는 과정입니다.",
        relatedKeys: ["bootloader", "kernel", "init-process"],
        keywords: ["booting", "부팅", "커널 적재"],
      },
      {
        key: "bootloader",
        label: "부트로더",
        description: "운영체제 커널을 저장장치에서 찾아 메모리에 적재하고 실행하는 프로그램입니다.",
        relatedKeys: ["booting", "kernel", "grub"],
        keywords: ["bootloader", "부트로더", "커널 로드"],
      },
      {
        key: "init-process",
        label: "init 프로세스",
        description: "시스템 부팅 후 가장 먼저 실행되는 사용자 공간 프로세스로, 다른 시스템 서비스를 시작합니다.",
        relatedKeys: ["booting", "process", "systemd"],
        keywords: ["init", "init process", "첫 프로세스"],
      },
      {
        key: "systemd",
        label: "systemd",
        description: "Linux에서 시스템 초기화와 서비스 관리를 담당하는 init 시스템입니다.",
        relatedKeys: ["init-process", "service", "linux"],
        keywords: ["systemd", "서비스 관리", "Linux"],
      },
      {
        key: "daemon",
        label: "데몬",
        description: "백그라운드에서 지속적으로 실행되며 특정 서비스를 제공하는 프로세스입니다.",
        relatedKeys: ["service", "systemd", "process"],
        keywords: ["daemon", "데몬", "백그라운드"],
      },
      {
        key: "service",
        label: "서비스",
        description: "운영체제에서 백그라운드로 실행되며 특정 기능을 제공하는 프로그램 단위입니다.",
        relatedKeys: ["daemon", "systemd", "init-process"],
        keywords: ["service", "서비스", "백그라운드 프로그램"],
      },

      {
        key: "virtualization",
        label: "가상화",
        description: "물리 하드웨어 위에 여러 개의 가상 실행 환경을 만들어 운영체제나 프로그램을 독립적으로 실행하는 기술입니다.",
        relatedKeys: ["hypervisor", "virtual-machine", "container"],
        keywords: ["virtualization", "가상화", "가상 머신"],
      },
      {
        key: "hypervisor",
        label: "하이퍼바이저",
        description: "가상 머신을 생성하고 관리하며 물리 하드웨어 자원을 분배하는 소프트웨어 계층입니다.",
        relatedKeys: ["virtualization", "virtual-machine", "type1-hypervisor"],
        keywords: ["hypervisor", "하이퍼바이저", "가상 머신 관리"],
      },
      {
        key: "virtual-machine",
        label: "가상 머신",
        description: "물리 컴퓨터처럼 동작하는 가상 실행 환경으로, 독립적인 운영체제를 실행할 수 있습니다.",
        relatedKeys: ["virtualization", "hypervisor", "guest-os"],
        keywords: ["virtual machine", "VM", "가상 머신"],
      },
      {
        key: "guest-os",
        label: "게스트 OS",
        description: "가상 머신 내부에서 실행되는 운영체제입니다.",
        relatedKeys: ["virtual-machine", "host-os", "hypervisor"],
        keywords: ["guest OS", "게스트 운영체제", "VM"],
      },
      {
        key: "host-os",
        label: "호스트 OS",
        description: "가상화 환경에서 물리 하드웨어 위에 직접 설치되어 가상 머신이나 컨테이너를 실행하는 운영체제입니다.",
        relatedKeys: ["guest-os", "virtualization", "container"],
        keywords: ["host OS", "호스트 운영체제", "가상화"],
      },
      {
        key: "container",
        label: "컨테이너",
        description: "호스트 OS 커널을 공유하면서 애플리케이션과 실행 환경을 격리해 실행하는 가상화 방식입니다.",
        relatedKeys: ["virtualization", "namespace", "cgroup"],
        keywords: ["container", "컨테이너", "격리 실행"],
      },
      {
        key: "namespace",
        label: "네임스페이스",
        description: "Linux에서 프로세스, 네트워크, 파일 시스템 등의 자원 보기를 분리해 격리 환경을 만드는 기능입니다.",
        relatedKeys: ["container", "cgroup", "isolation"],
        keywords: ["namespace", "네임스페이스", "격리"],
      },
      {
        key: "cgroup",
        label: "cgroup",
        description: "Linux에서 프로세스 그룹의 CPU, 메모리, I/O 같은 자원 사용량을 제한하고 관리하는 기능입니다.",
        relatedKeys: ["container", "namespace", "resource-control"],
        keywords: ["cgroup", "control group", "자원 제한"],
      },
      {
        key: "isolation",
        label: "격리",
        description: "프로세스나 실행 환경이 서로의 자원과 상태에 영향을 주지 않도록 분리하는 성질입니다.",
        relatedKeys: ["container", "namespace", "protection"],
        keywords: ["isolation", "격리", "분리"],
      },

      {
        key: "security",
        label: "운영체제 보안",
        description: "운영체제가 사용자, 프로세스, 파일, 네트워크 자원을 안전하게 보호하는 기능입니다.",
        relatedKeys: ["authentication", "authorization", "access-control"],
        keywords: ["security", "보안", "운영체제 보안"],
      },
      {
        key: "authentication",
        label: "인증",
        description: "사용자나 시스템의 신원을 확인하는 과정입니다.",
        relatedKeys: ["authorization", "security", "password"],
        keywords: ["authentication", "인증", "신원 확인"],
      },
      {
        key: "authorization",
        label: "인가",
        description: "인증된 사용자가 특정 자원이나 기능에 접근할 권한이 있는지 결정하는 과정입니다.",
        relatedKeys: ["authentication", "access-control", "permission"],
        keywords: ["authorization", "인가", "권한 확인"],
      },
      {
        key: "protection",
        label: "보호",
        description: "프로세스와 사용자가 허용된 자원에만 접근하도록 제한하는 운영체제 기능입니다.",
        relatedKeys: ["memory-protection", "access-control", "security"],
        keywords: ["protection", "보호", "접근 제한"],
      },
      {
        key: "privilege-escalation",
        label: "권한 상승",
        description: "낮은 권한의 사용자나 프로세스가 더 높은 권한을 획득하는 보안 문제 또는 공격 방식입니다.",
        relatedKeys: ["security", "kernel-mode", "access-control"],
        keywords: ["privilege escalation", "권한 상승", "보안 취약점"],
      },
      {
        key: "sandbox",
        label: "샌드박스",
        description: "프로그램을 제한된 환경에서 실행해 시스템 전체에 미치는 영향을 줄이는 보안 기법입니다.",
        relatedKeys: ["isolation", "security", "container"],
        keywords: ["sandbox", "샌드박스", "제한 실행"],
      },

      {
        key: "distributed-system",
        label: "분산 시스템",
        description: "여러 컴퓨터가 네트워크로 연결되어 하나의 시스템처럼 협력하는 구조입니다.",
        relatedKeys: ["distributed-os", "network-os", "rpc"],
        keywords: ["distributed system", "분산 시스템", "네트워크"],
      },
      {
        key: "distributed-os",
        label: "분산 운영체제",
        description: "여러 컴퓨터의 자원을 하나의 통합된 시스템처럼 보이게 관리하는 운영체제입니다.",
        relatedKeys: ["distributed-system", "network-os", "transparency"],
        keywords: ["distributed OS", "분산 운영체제", "투명성"],
      },
      {
        key: "network-os",
        label: "네트워크 운영체제",
        description: "네트워크를 통해 파일 공유, 원격 로그인, 프린터 공유 같은 기능을 제공하는 운영체제입니다.",
        relatedKeys: ["distributed-os", "distributed-system"],
        keywords: ["network OS", "네트워크 운영체제", "자원 공유"],
      },
      {
        key: "rpc",
        label: "RPC",
        description: "Remote Procedure Call의 약자로, 원격 시스템의 함수를 로컬 함수처럼 호출하는 통신 방식입니다.",
        relatedKeys: ["distributed-system", "client-server", "ipc"],
        keywords: ["RPC", "remote procedure call", "원격 호출"],
      },
      {
        key: "client-server",
        label: "클라이언트-서버 구조",
        description: "서비스를 요청하는 클라이언트와 서비스를 제공하는 서버로 역할을 나누는 시스템 구조입니다.",
        relatedKeys: ["rpc", "distributed-system", "network-os"],
        keywords: ["client server", "클라이언트 서버", "요청 응답"],
      },

      {
        key: "ipc",
        label: "IPC",
        description: "Inter-Process Communication의 약자로, 프로세스들 사이에서 데이터를 주고받는 통신 방식입니다.",
        relatedKeys: ["pipe", "message-queue", "shared-memory"],
        keywords: ["IPC", "프로세스 간 통신", "inter process communication"],
      },
      {
        key: "pipe",
        label: "파이프",
        description: "한 프로세스의 출력 데이터를 다른 프로세스의 입력으로 전달하는 IPC 방식입니다.",
        relatedKeys: ["ipc", "named-pipe", "shell"],
        keywords: ["pipe", "파이프", "프로세스 통신"],
      },
      {
        key: "named-pipe",
        label: "Named Pipe",
        description: "파일 시스템에 이름을 가진 파이프로, 관련 없는 프로세스 사이에서도 통신할 수 있게 합니다.",
        relatedKeys: ["pipe", "ipc", "fifo"],
        keywords: ["named pipe", "이름 있는 파이프", "FIFO"],
      },
      {
        key: "message-queue",
        label: "메시지 큐",
        description: "프로세스들이 메시지 단위로 데이터를 주고받을 수 있도록 하는 IPC 방식입니다.",
        relatedKeys: ["ipc", "shared-memory", "synchronization"],
        keywords: ["message queue", "메시지 큐", "IPC"],
      },
      {
        key: "shared-memory",
        label: "공유 메모리",
        description: "여러 프로세스가 같은 메모리 영역을 공유해 데이터를 빠르게 주고받는 IPC 방식입니다.",
        relatedKeys: ["ipc", "synchronization", "race-condition"],
        keywords: ["shared memory", "공유 메모리", "IPC"],
      },
      {
        key: "socket",
        label: "소켓",
        description: "네트워크나 로컬 시스템에서 프로세스 간 통신을 수행하기 위한 통신 끝점입니다.",
        relatedKeys: ["ipc", "network-os", "client-server"],
        keywords: ["socket", "소켓", "통신"],
      },

      {
        key: "shell",
        label: "셸",
        description: "사용자가 명령어를 입력해 운영체제 기능을 사용할 수 있게 해주는 명령어 해석기입니다.",
        relatedKeys: ["command-line-interface", "pipe", "process"],
        keywords: ["shell", "셸", "명령어 해석기"],
      },
      {
        key: "command-line-interface",
        label: "CLI",
        description: "명령어 텍스트를 입력해 프로그램과 운영체제를 제어하는 사용자 인터페이스입니다.",
        relatedKeys: ["shell", "terminal", "gui"],
        keywords: ["CLI", "command line", "명령줄"],
      },
      {
        key: "gui",
        label: "GUI",
        description: "창, 아이콘, 버튼 같은 그래픽 요소로 운영체제와 프로그램을 조작하는 사용자 인터페이스입니다.",
        relatedKeys: ["command-line-interface", "window-system"],
        keywords: ["GUI", "graphical user interface", "그래픽 인터페이스"],
      },
      {
        key: "terminal",
        label: "터미널",
        description: "사용자가 셸과 상호작용하기 위해 사용하는 텍스트 기반 입출력 환경입니다.",
        relatedKeys: ["shell", "command-line-interface"],
        keywords: ["terminal", "터미널", "명령어 입력"],
      },

      {
        key: "real-time-os",
        label: "실시간 운영체제",
        description: "정해진 시간 제한 안에 작업을 완료하는 것을 중요하게 다루는 운영체제입니다.",
        relatedKeys: ["hard-real-time", "soft-real-time", "deadline"],
        keywords: ["RTOS", "real time OS", "실시간 운영체제"],
      },
      {
        key: "hard-real-time",
        label: "Hard Real-Time",
        description: "마감 시간을 반드시 지켜야 하며, 실패하면 치명적인 문제가 발생할 수 있는 실시간 시스템입니다.",
        relatedKeys: ["real-time-os", "deadline", "schedulability"],
        keywords: ["hard real time", "하드 실시간", "마감 시간"],
      },
      {
        key: "soft-real-time",
        label: "Soft Real-Time",
        description: "마감 시간을 넘겨도 시스템 실패는 아니지만 서비스 품질이 저하될 수 있는 실시간 시스템입니다.",
        relatedKeys: ["real-time-os", "deadline", "quality-of-service"],
        keywords: ["soft real time", "소프트 실시간", "품질 저하"],
      },
      {
        key: "deadline",
        label: "Deadline",
        description: "실시간 시스템에서 작업이 완료되어야 하는 시간 제한입니다.",
        relatedKeys: ["real-time-os", "hard-real-time", "soft-real-time"],
        keywords: ["deadline", "마감 시간", "시간 제한"],
      },
      {
        key: "schedulability",
        label: "스케줄 가능성",
        description: "주어진 작업들이 시간 제약을 만족하며 실행될 수 있는지를 판단하는 성질입니다.",
        relatedKeys: ["deadline", "real-time-os", "cpu-scheduling"],
        keywords: ["schedulability", "스케줄 가능성", "실시간"],
      },

      {
        key: "performance",
        label: "성능",
        description: "운영체제나 시스템이 작업을 얼마나 빠르고 효율적으로 처리하는지를 나타내는 평가 관점입니다.",
        relatedKeys: ["throughput", "response-time", "cpu-utilization"],
        keywords: ["performance", "성능", "효율"],
      },
      {
        key: "scalability",
        label: "확장성",
        description: "사용자 수, 프로세스 수, 자원 규모가 증가해도 시스템이 성능을 유지하거나 개선할 수 있는 능력입니다.",
        relatedKeys: ["performance", "distributed-system", "multicore"],
        keywords: ["scalability", "확장성", "규모 증가"],
      },
      {
        key: "reliability",
        label: "신뢰성",
        description: "시스템이 오류나 장애 상황에서도 안정적으로 동작할 수 있는 성질입니다.",
        relatedKeys: ["fault-tolerance", "crash-consistency", "recovery"],
        keywords: ["reliability", "신뢰성", "안정성"],
      },
      {
        key: "fault-tolerance",
        label: "결함 허용",
        description: "일부 구성 요소에 장애가 발생해도 시스템 전체가 계속 동작할 수 있도록 하는 성질입니다.",
        relatedKeys: ["reliability", "recovery", "distributed-system"],
        keywords: ["fault tolerance", "결함 허용", "장애 대응"],
      },
      {
        key: "recovery",
        label: "복구",
        description: "시스템 오류나 장애 후 정상 상태로 되돌리는 과정입니다.",
        relatedKeys: ["fault-tolerance", "journaling", "crash-consistency"],
        keywords: ["recovery", "복구", "장애 회복"],
      },
    ],
  },
  ml: {
    subject: "머신러닝",
    coreLabel: "모델 학습",
    coreDescription: "데이터를 바탕으로 패턴을 찾고 예측 성능을 높이는 전체 과정을 묶는 중심 개념입니다.",
    coreKeywords: ["정규화", "손실", "경사하강법", "과적합"],
    concepts: [
      {
        key: "normalization",
        label: "정규화",
        description: "특성 스케일을 맞춰 학습이 안정적으로 진행되도록 돕는 전처리입니다.",
        relatedKeys: ["gradient", "feature-scale"],
        keywords: ["정규화", "스케일", "표준화"],
      },
      {
        key: "loss",
        label: "손실 함수",
        description: "모델 예측이 얼마나 틀렸는지 수치로 나타내는 기준입니다.",
        relatedKeys: ["gradient", "overfitting"],
        keywords: ["손실", "loss", "cost"],
      },
      {
        key: "gradient",
        label: "경사하강법",
        description: "손실을 줄이는 방향으로 파라미터를 갱신하는 최적화 방법입니다.",
        relatedKeys: ["loss", "normalization"],
        keywords: ["경사하강법", "gradient", "optimizer"],
      },
      {
        key: "overfitting",
        label: "과적합",
        description: "학습 데이터에는 잘 맞지만 새로운 데이터에는 약한 상태를 의미합니다.",
        relatedKeys: ["loss", "feature-scale"],
        keywords: ["과적합", "overfitting", "regularization"],
      },
      {
        key: "feature-scale",
        label: "특징 스케일",
        description: "입력 특성의 크기 차이가 학습 안정성과 속도에 미치는 영향을 다룹니다.",
        relatedKeys: ["normalization", "gradient"],
        keywords: ["feature", "특성", "스케일"],
      },
    ],
  },
  db: {
    subject: "데이터베이스",
    coreLabel: "SQL 학습",
    coreDescription: "관계형 데이터베이스를 조회하고 설계하는 핵심 문법과 개념을 묶는 중심 노드입니다.",
    coreKeywords: ["join", "인덱스", "트랜잭션", "정규화"],
    concepts: [
      {
        key: "join",
        label: "JOIN",
        description: "여러 테이블을 공통 키를 기준으로 결합하는 조회 방식입니다.",
        relatedKeys: ["index", "plan"],
        keywords: ["join", "inner join", "left join", "right join"],
      },
      {
        key: "index",
        label: "인덱스",
        description: "조회 속도를 높이기 위한 탐색 구조로, 조건 검색과 밀접하게 연결됩니다.",
        relatedKeys: ["join", "plan"],
        keywords: ["인덱스", "index"],
      },
      {
        key: "transaction",
        label: "트랜잭션",
        description: "데이터 변경 작업을 하나의 안전한 단위로 묶어 처리하는 개념입니다.",
        relatedKeys: ["normalization", "plan"],
        keywords: ["트랜잭션", "transaction", "commit", "rollback"],
      },
      {
        key: "normalization",
        label: "정규화",
        description: "중복을 줄이고 데이터 일관성을 높이도록 테이블을 구조화하는 과정입니다.",
        relatedKeys: ["transaction", "join"],
        keywords: ["정규화", "normalization"],
      },
      {
        key: "plan",
        label: "실행 계획",
        description: "쿼리를 어떻게 수행할지 DB 엔진이 선택한 절차를 보여주는 정보입니다.",
        relatedKeys: ["join", "index"],
        keywords: ["실행 계획", "execution plan", "explain"],
      },
    ],
  },
  network: {
    subject: "네트워크",
    coreLabel: "TCP",
    coreDescription: "신뢰성 있는 전송을 위해 연결 수립, 흐름 제어, 혼잡 제어를 담당하는 핵심 프로토콜입니다.",
    coreKeywords: ["tcp", "handshake", "흐름 제어", "혼잡 제어"],
    concepts: [
      {
        key: "handshake",
        label: "3-way handshake",
        description: "TCP 연결을 수립할 때 클라이언트와 서버가 주고받는 세 단계 절차입니다.",
        relatedKeys: ["flow-control", "ack"],
        keywords: ["3-way", "handshake", "syn", "ack"],
      },
      {
        key: "flow-control",
        label: "흐름 제어",
        description: "수신 측이 처리 가능한 만큼만 데이터를 보내도록 조절하는 메커니즘입니다.",
        relatedKeys: ["congestion", "ack"],
        keywords: ["흐름 제어", "flow control", "window"],
      },
      {
        key: "congestion",
        label: "혼잡 제어",
        description: "네트워크가 과부하 상태에 빠지지 않도록 전송량을 조절하는 전략입니다.",
        relatedKeys: ["flow-control", "routing"],
        keywords: ["혼잡", "congestion", "slow start"],
      },
      {
        key: "ack",
        label: "ACK",
        description: "상대가 데이터를 정상적으로 받았는지 확인하기 위해 보내는 응답 신호입니다.",
        relatedKeys: ["handshake", "flow-control"],
        keywords: ["ack", "응답", "재전송"],
      },
      {
        key: "routing",
        label: "라우팅",
        description: "패킷이 목적지까지 어떤 경로로 이동할지 결정하는 과정입니다.",
        relatedKeys: ["congestion", "flow-control"],
        keywords: ["라우팅", "routing", "경로"],
      },
    ],
  },
};

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function uniqueStrings(items: string[]) {
  return [...new Set(items)];
}

function uniqueEdges(edges: ProjectKnowledgeGraphEdge[]) {
  const seen = new Set<string>();

  return edges.filter((edge) => {
    const key = [edge.source, edge.target].sort().join("::");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function truncateLabel(label: string, maxLength = 28) {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function buildPreview(chat: Chat) {
  const firstUserMessage = chat.messages.find((message) => message.role === "user") || chat.messages[0] || null;

  return {
    messageId: firstUserMessage?.id || null,
    preview: firstUserMessage?.text || chat.title,
  };
}

function findConceptMatches(text: string, conceptNodes: ProjectKnowledgeGraphNode[]) {
  const normalized = text.toLowerCase();
  const matches = conceptNodes
    .filter((concept) =>
      (concept.keywords || []).some((keyword) => normalized.includes(keyword.toLowerCase()))
    )
    .map((concept) => concept.id);

  return matches;
}

function buildConceptNodeId(projectId: string, key: string) {
  return `${projectId}-concept-${key}`;
}

const projectConceptDisplayRatios: Record<string, number> = {
  os: 0.8,
};

const generatedConceptColors = [
  "#7dd3fc",
  "#93c5fd",
  "#c4b5fd",
  "#f9a8d4",
  "#34d399",
  "#fb923c",
  "#a78bfa",
  "#60a5fa",
];

function clampGraphPosition(value: number) {
  return Math.max(0.06, Math.min(0.94, value));
}

function getConceptLayoutSlot(index: number, totalCount: number) {
  const slotId = dashboardGraphSlotIds.concept[index];
  const slot = slotId ? getGraphLayoutSlot(slotId) : null;

  if (slot) {
    return slot;
  }

  const extraIndex = index - dashboardGraphSlotIds.concept.length;
  const extraCount = Math.max(1, totalCount - dashboardGraphSlotIds.concept.length);
  const angle = extraIndex * Math.PI * (3 - Math.sqrt(5));
  const density = Math.sqrt((extraIndex + 1) / extraCount);
  const radius = 0.24 + density * 0.34;

  return {
    id: `generated-concept-${index}`,
    x: clampGraphPosition(0.5 + Math.cos(angle) * radius),
    y: clampGraphPosition(0.52 + Math.sin(angle) * radius * 0.82),
    size: Math.max(2.35, 3.5 - density * 0.75),
    color: generatedConceptColors[extraIndex % generatedConceptColors.length],
  };
}

function getDependencyWeightedConcepts(projectId: string, concepts: GraphConceptPreset[]) {
  const ratio = projectConceptDisplayRatios[projectId];

  if (!ratio || ratio >= 1 || concepts.length <= 1) {
    return concepts;
  }

  const targetCount = Math.max(1, Math.round(concepts.length * ratio));

  if (concepts.length <= targetCount) {
    return concepts;
  }

  const conceptKeySet = new Set(concepts.map((concept) => concept.key));
  const scores = new Map(
    concepts.map((concept, index) => [
      concept.key,
      {
        index,
        score: 0,
      },
    ])
  );

  concepts.forEach((concept) => {
    const sourceScore = scores.get(concept.key);
    const relatedKeys = uniqueStrings(
      concept.relatedKeys.filter((key) => key !== concept.key && conceptKeySet.has(key))
    );

    if (sourceScore) {
      sourceScore.score += relatedKeys.length;
    }

    relatedKeys.forEach((key) => {
      const relatedScore = scores.get(key);

      if (relatedScore) {
        relatedScore.score += 2;
      }
    });
  });

  const selectedKeys = new Set(
    [...scores.entries()]
      .sort(([, left], [, right]) => right.score - left.score || left.index - right.index)
      .slice(0, targetCount)
      .map(([key]) => key)
  );

  return concepts.filter((concept) => selectedKeys.has(concept.key));
}

function buildPresetGraph(projectData: ProjectDataInput, chats: Chat[], preset: GraphProjectPreset): ProjectKnowledgeGraphData {
  const coreSlot = getGraphLayoutSlot(dashboardGraphSlotIds.core);

  if (!coreSlot) {
    return { nodes: [], edges: [], defaultSelectedNodeId: null };
  }

  const coreNodeId = `${projectData.projectId}-core`;
  const displayConcepts = getDependencyWeightedConcepts(projectData.projectId, preset.concepts);
  const conceptKeySet = new Set(displayConcepts.map((concept) => concept.key));
  const conceptNodes: ProjectKnowledgeGraphNode[] = displayConcepts.map((concept, index) => {
    const slot = getConceptLayoutSlot(index, displayConcepts.length);

    return {
      id: buildConceptNodeId(projectData.projectId, concept.key),
      label: concept.label,
      x: slot.x,
      y: slot.y,
      size: slot.size + 0.35,
      color: slot.color,
      kind: "concept" as const,
      subtitle: preset.subject,
      description: concept.description,
      relatedConceptIds: uniqueStrings(
        concept.relatedKeys
          .filter((key) => key !== concept.key && conceptKeySet.has(key))
          .map((key) => buildConceptNodeId(projectData.projectId, key))
      ),
      relatedLearningEvents: [],
      keywords: concept.keywords,
    };
  });

  const coreNode: ProjectKnowledgeGraphNode = {
    id: coreNodeId,
    label: preset.coreLabel,
    x: coreSlot.x,
    y: coreSlot.y,
    size: coreSlot.size + 0.8,
    color: coreSlot.color,
    isCore: true,
    kind: "concept",
    subtitle: preset.subject,
    description: preset.coreDescription,
    relatedConceptIds: conceptNodes.map((node) => node.id),
    relatedLearningEvents: [],
    keywords: preset.coreKeywords,
  };

  const baseEdges: ProjectKnowledgeGraphEdge[] = conceptNodes.map((node) => ({
    source: coreNodeId,
    target: node.id,
  }));

  conceptNodes.forEach((node) => {
    node.relatedConceptIds.forEach((relatedId) => {
      baseEdges.push({ source: node.id, target: relatedId });
    });
  });

  const chatNodes = chats
    .slice(0, dashboardGraphSlotIds.chat.length)
    .flatMap((chat, index): ProjectKnowledgeGraphNode[] => {
      const slot = getGraphLayoutSlot(dashboardGraphSlotIds.chat[index]);
      const previewInfo = buildPreview(chat);

      if (!slot) {
        return [];
      }

      const relatedConceptIds = findConceptMatches(
        `${chat.title} ${chat.messages.map((message) => message.text).join(" ")}`,
        conceptNodes
      );
      const nextRelatedConceptIds = relatedConceptIds.length ? relatedConceptIds : [coreNodeId];
      const learningEvent: ProjectKnowledgeGraphEvent = {
        id: `event-${chat.id}`,
        chatId: chat.id,
        messageId: previewInfo.messageId,
        preview: previewInfo.preview,
        updatedAt: chat.updatedAt,
      };

      nextRelatedConceptIds.forEach((conceptId) => {
        const targetNode = conceptId === coreNodeId ? coreNode : conceptNodes.find((node) => node.id === conceptId);

        if (targetNode) {
          targetNode.relatedLearningEvents.push(learningEvent);
        }
      });

      if (!nextRelatedConceptIds.includes(coreNodeId)) {
        coreNode.relatedLearningEvents.push(learningEvent);
      }

      nextRelatedConceptIds.forEach((conceptId) => {
        baseEdges.push({ source: `chat-${chat.id}`, target: conceptId });
      });

      return [
        {
          id: `chat-${chat.id}`,
          label: truncateLabel(chat.title),
          x: slot.x,
          y: slot.y,
          size: slot.size,
          color: slot.color,
          kind: "chat" as const,
          subtitle: "최근 학습 경험",
          description: `${projectData.title} 안에서 진행한 대화입니다. "${previewInfo.preview}"를 중심으로 학습이 이어졌습니다.`,
          relatedConceptIds: nextRelatedConceptIds.filter((conceptId) => conceptId !== coreNodeId),
          relatedLearningEvents: [learningEvent],
        },
      ];
    });

  const finalizedNodes: ProjectKnowledgeGraphNode[] = [
    coreNode,
    ...conceptNodes,
    ...chatNodes,
  ];

  return {
    nodes: uniqueById(finalizedNodes).map((node) => ({
      ...node,
      relatedLearningEvents: uniqueById(node.relatedLearningEvents),
    })),
    edges: uniqueEdges(baseEdges),
    defaultSelectedNodeId: coreNode.id,
  };
}

function buildGenericProjectGraph(projectData: ProjectDataInput, chats: Chat[]): ProjectKnowledgeGraphData {
  const coreSlot = getGraphLayoutSlot(dashboardGraphSlotIds.core);

  if (!coreSlot) {
    return { nodes: [], edges: [], defaultSelectedNodeId: null };
  }

  const coreNodeId = `${projectData.projectId}-project-core`;
  const coreNode: ProjectKnowledgeGraphNode = {
    id: coreNodeId,
    label: projectData.title,
    x: coreSlot.x,
    y: coreSlot.y,
    size: coreSlot.size + 0.8,
    color: coreSlot.color,
    isCore: true,
    kind: "project",
    subtitle: "프로젝트 중심",
    description: "아직 개념 그래프가 정리되지 않은 프로젝트입니다. 현재는 이 프로젝트 안에서 만들어진 채팅 흐름을 중심으로 그래프를 구성합니다.",
    relatedConceptIds: [],
    relatedLearningEvents: [],
  };

  const chatNodes = chats
    .slice(0, dashboardGraphSlotIds.chat.length)
    .flatMap((chat, index): ProjectKnowledgeGraphNode[] => {
      const slot = getGraphLayoutSlot(dashboardGraphSlotIds.chat[index]);
      const previewInfo = buildPreview(chat);
      const learningEvent: ProjectKnowledgeGraphEvent = {
        id: `event-${chat.id}`,
        chatId: chat.id,
        messageId: previewInfo.messageId,
        preview: previewInfo.preview,
        updatedAt: chat.updatedAt,
      };

      coreNode.relatedLearningEvents.push(learningEvent);

      if (!slot) {
        return [];
      }

      return [
        {
          id: `chat-${chat.id}`,
          label: truncateLabel(chat.title),
          x: slot.x,
          y: slot.y,
          size: slot.size,
          color: slot.color,
          kind: "chat" as const,
          subtitle: "최근 학습 경험",
          description: `${projectData.title} 안에서 진행한 대화입니다. "${previewInfo.preview}"를 중심으로 학습이 이어졌습니다.`,
          relatedConceptIds: [],
          relatedLearningEvents: [learningEvent],
        },
      ];
    });

  const finalizedNodes: ProjectKnowledgeGraphNode[] = [
    coreNode,
    ...chatNodes,
  ];

  return {
    nodes: uniqueById(finalizedNodes).map((node) => ({
      ...node,
      relatedLearningEvents: uniqueById(node.relatedLearningEvents),
    })),
    edges: uniqueEdges(
      chatNodes
        .filter(Boolean)
        .map((chatNode) => ({
          source: coreNodeId,
          target: chatNode!.id,
        }))
    ),
    defaultSelectedNodeId: coreNode.id,
  };
}

export function buildProjectKnowledgeGraph(projectData: ProjectDataInput | null, chats: Chat[]) {
  if (!projectData) {
    return {
      nodes: [],
      edges: [],
      defaultSelectedNodeId: null,
    } satisfies ProjectKnowledgeGraphData;
  }

  const preset = graphProjectPresets[projectData.projectId];

  return preset
    ? buildPresetGraph(projectData, chats, preset)
    : buildGenericProjectGraph(projectData, chats);
}

export function buildBackendKnowledgeGraph(
  projectData: ProjectDataInput | null,
  backendGraph: BackendGraphData | null,
  chats: Chat[]
) {
  if (!projectData || !backendGraph?.nodes?.length) {
    return buildProjectKnowledgeGraph(projectData, chats);
  }

  const nodesById = new Map(backendGraph.nodes.map((node) => [node.node_id, node]));
  const relatedIdsByNode = new Map<string, string[]>();

  (backendGraph.edges || []).forEach((edge) => {
    if (!nodesById.has(edge.source_node_id) || !nodesById.has(edge.target_node_id)) {
      return;
    }

    relatedIdsByNode.set(edge.source_node_id, [
      ...(relatedIdsByNode.get(edge.source_node_id) || []),
      edge.target_node_id,
    ]);
    relatedIdsByNode.set(edge.target_node_id, [
      ...(relatedIdsByNode.get(edge.target_node_id) || []),
      edge.source_node_id,
    ]);
  });

  const uiNodes = backendGraph.nodes.map((node, index) => {
    const slot =
      getGraphLayoutSlot(index === 0 ? dashboardGraphSlotIds.core : dashboardGraphSlotIds.concept[(index - 1) % dashboardGraphSlotIds.concept.length]);
    const fallbackAngle = (Math.PI * 2 * index) / Math.max(backendGraph.nodes!.length, 1);
    const fallbackRadius = index === 0 ? 0 : 0.28;
    const x = slot?.x ?? 0.5 + Math.cos(fallbackAngle) * fallbackRadius;
    const y = slot?.y ?? 0.5 + Math.sin(fallbackAngle) * fallbackRadius;
    const chatEvents = chats.flatMap((chat) => {
      const matched = `${chat.title} ${chat.messages.map((message) => message.text).join(" ")}`
        .toLowerCase()
        .includes(node.name.toLowerCase());

      if (!matched) {
        return [];
      }

      const preview = buildPreview(chat);

      return [
        {
          id: `event-${chat.id}-${node.node_id}`,
          chatId: chat.id,
          messageId: preview.messageId,
          preview: preview.preview,
          updatedAt: chat.updatedAt,
        },
      ];
    });

    return {
      id: node.node_id,
      label: node.name,
      x,
      y,
      size: (slot?.size || 1) + (index === 0 ? 0.55 : 0.18),
      color: slot?.color || "#8b5cf6",
      isCore: index === 0,
      kind: "concept" as const,
      subtitle: node.group || node.status || "개념 노드",
      description: node.description || "아직 개념 설명이 없습니다.",
      relatedConceptIds: uniqueStrings(relatedIdsByNode.get(node.node_id) || []),
      relatedLearningEvents: uniqueById(chatEvents),
      keywords: [node.name],
    };
  });

  return {
    nodes: uiNodes,
    edges: uniqueEdges(
      (backendGraph.edges || [])
        .filter((edge) => nodesById.has(edge.source_node_id) && nodesById.has(edge.target_node_id))
        .map((edge) => ({
          source: edge.source_node_id,
          target: edge.target_node_id,
        }))
    ),
    defaultSelectedNodeId: uiNodes[0]?.id || null,
  } satisfies ProjectKnowledgeGraphData;
}

export function buildIntegratedKnowledgeGraph(projectGraphs: IntegratedProjectGraphInput[]) {
  const clusterCenters = [
    { x: 0.32, y: 0.32 },
    { x: 0.64, y: 0.32 },
    { x: 0.34, y: 0.64 },
    { x: 0.66, y: 0.64 },
    { x: 0.5, y: 0.5 },
    { x: 0.24, y: 0.5 },
    { x: 0.76, y: 0.5 },
  ];
  const clusterScale = projectGraphs.length > 4 ? 0.28 : 0.34;
  const nodes: ProjectKnowledgeGraphNode[] = [];
  const edges: ProjectKnowledgeGraphEdge[] = [];

  projectGraphs.forEach(({ project, graph }, index) => {
    const center = clusterCenters[index % clusterCenters.length];
    const offsetTurn = Math.floor(index / clusterCenters.length);
    const offsetX = offsetTurn ? Math.sin(index * 1.7) * 0.04 : 0;
    const offsetY = offsetTurn ? Math.cos(index * 1.3) * 0.04 : 0;

    graph.nodes.forEach((node) => {
      nodes.push({
        ...node,
        id: `${project.projectId}::${node.id}`,
        x: Math.min(Math.max(center.x + offsetX + (node.x - 0.5) * clusterScale, 0.06), 0.94),
        y: Math.min(Math.max(center.y + offsetY + (node.y - 0.5) * clusterScale, 0.08), 0.92),
        size: node.isCore ? node.size * 0.82 : node.size * 0.72,
        subtitle: `${project.title} · ${node.subtitle}`,
        relatedConceptIds: node.relatedConceptIds.map((nodeId) => `${project.projectId}::${nodeId}`),
      });
    });

    graph.edges.forEach((edge) => {
      edges.push({
        source: `${project.projectId}::${edge.source}`,
        target: `${project.projectId}::${edge.target}`,
      });
    });
  });

  return {
    nodes: uniqueById(nodes),
    edges: uniqueEdges(edges),
    defaultSelectedNodeId: nodes.find((node) => node.isCore)?.id || nodes[0]?.id || null,
  } satisfies ProjectKnowledgeGraphData;
}
